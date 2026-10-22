import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { audit } from '../../utils/audit.js';
import { createId } from '../../utils/id.js';
import { logger } from '../../utils/logger.js';
import { processScheduledSends } from '../../jobs/processScheduledSends.js';
import { activeApplication, ownedMatch } from '../matches/access.js';

/**
 * Besides the 5-second sweep, a one-off timer fires just after the undo window so sending feels immediate.
 * The sweep still catches anything this misses (for example after a restart).
 */
function scheduleSoon(ms: number) {
  if (env.isTest) return;
  setTimeout(() => {
    processScheduledSends().catch((err) => logger.error({ err: (err as Error).message }, 'scheduled send failed'));
  }, ms + 250).unref();
}

/**
 * Creates the application in the "approved" state with scheduledSendAt = now + undo window.
 * Server rules: the user owns the match, both documents exist, and form answers are complete. Idempotent.
 */
export async function approveMatch(userId: string, matchId: string, idempotencyKey: string) {
  const byKey = await prisma.application.findUnique({ where: { idempotencyKey } });
  if (byKey) {
    if (byKey.userId !== userId || byKey.matchId !== matchId) throw conflict('idempotency_conflict', 'This request was already used.');
    return { created: false, body: approvalBody(byKey) };
  }

  const match = await ownedMatch(userId, matchId);
  if (match.job.applyRoute === 'site') throw badRequest('wrong_route', "This job is finished on the employer's site.");
  const live = await activeApplication(match.id);
  if (live) return { created: false, body: approvalBody(live) };

  const docs = await prisma.document.findMany({ where: { matchId: match.id }, select: { type: true } });
  if (!docs.some((d) => d.type === 'cv') || !docs.some((d) => d.type === 'cover_letter')) {
    throw conflict('documents_missing', 'Your CV and cover letter are not ready yet.');
  }
  if (match.job.applyRoute === 'form') {
    const missing = await prisma.formAnswer.findMany({
      where: { matchId: match.id, OR: [{ needsAttention: true }, { value: '' }] },
      select: { label: true },
    });
    if (missing.length) throw conflict('answers_needed', `Add your ${missing[0].label.toLowerCase()} to continue.`);
  }

  const now = new Date();
  const app = await prisma.application.create({
    data: {
      userId,
      matchId: match.id,
      jobId: match.jobId,
      route: match.job.applyRoute,
      status: 'approved',
      approvedAt: now,
      scheduledSendAt: new Date(now.getTime() + env.UNDO_WINDOW_SECONDS * 1000),
      idempotencyKey,
    },
  });
  await audit(userId, 'application.approved', { applicationId: app.id, route: app.route });
  scheduleSoon(env.UNDO_WINDOW_SECONDS * 1000);
  return { created: true, body: approvalBody(app) };
}

function approvalBody(a: { id: string; scheduledSendAt: Date | null; status: string; sentAt: Date | null }) {
  return {
    applicationId: a.id,
    scheduledSendAt: a.scheduledSendAt,
    status: a.status,
    sentAt: a.sentAt,
    undoWindowSeconds: env.UNDO_WINDOW_SECONDS,
  };
}

/** Only possible before scheduledSendAt and before the sender has claimed the row. */
export async function undoApplication(userId: string, applicationId: string, now = new Date()) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || app.userId !== userId) throw notFound('We could not find this application.');
  const res = await prisma.application.updateMany({
    where: { id: app.id, status: 'approved', sentAt: null, undoneAt: null, scheduledSendAt: { gt: now } },
    data: { undoneAt: now, scheduledSendAt: null },
  });
  if (res.count !== 1) throw conflict('too_late', 'This application has already been sent.');
  if (app.matchId) await prisma.match.update({ where: { id: app.matchId }, data: { status: 'viewed' } });
  await audit(userId, 'application.undone', { applicationId: app.id });
}

/** The user applied on the employer's site. Nothing is sent by us. */
export async function markAppliedOnSite(userId: string, matchId: string) {
  const match = await ownedMatch(userId, matchId);
  if (match.job.applyRoute === 'email') throw badRequest('wrong_route', 'This job is applied to by email.');
  const now = new Date();
  const event = { type: 'applied_on_site', label: "You applied on the employer's site", occurredAt: now };
  const live = await activeApplication(match.id);

  if (live && live.status !== 'approved') return live;
  const app = live
    ? await prisma.application.update({
        where: { id: live.id },
        data: { status: 'applied', route: 'site', sendError: null, scheduledSendAt: null, events: { create: event } },
      })
    : await prisma.application.create({
        data: {
          userId,
          matchId: match.id,
          jobId: match.jobId,
          route: 'site',
          status: 'applied',
          approvedAt: now,
          idempotencyKey: `site-${createId()}`,
          events: { create: event },
        },
      });
  await prisma.match.update({ where: { id: match.id }, data: { status: 'applied' } });
  await audit(userId, 'application.applied_on_site', { applicationId: app.id });
  return app;
}

/** After a failed send: try again straight away. */
export async function retrySend(userId: string, applicationId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || app.userId !== userId) throw notFound('We could not find this application.');
  if (app.status !== 'approved' || app.sendError !== 'failed' || app.undoneAt) {
    throw conflict('cannot_retry', 'This application cannot be sent again.');
  }
  const updated = await prisma.application.update({
    where: { id: app.id },
    data: { sendError: null, scheduledSendAt: new Date() },
  });
  scheduleSoon(0);
  return updated;
}
