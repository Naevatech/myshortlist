import { senderFor } from '../services/send/index.js';
import { loadCandidate } from '../services/profileData.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

export const SEND_FAILED_MESSAGE = 'We could not send this application. Nothing was sent.';

/**
 * Sends every approved application whose undo window has ended. Each row is claimed with a conditional update
 * (UPDATE ... WHERE id = ? AND sentAt IS NULL AND undoneAt IS NULL) so it can never be sent twice, and an
 * application that was undone is never picked up.
 */
export async function processScheduledSends(now = new Date()) {
  const due = await prisma.application.findMany({
    where: { status: 'approved', undoneAt: null, sentAt: null, scheduledSendAt: { lte: now } },
    select: { id: true },
    take: 50,
  });

  let sent = 0;
  for (const { id } of due) {
    const claimed = await prisma.application.updateMany({
      where: { id, status: 'approved', undoneAt: null, sentAt: null, scheduledSendAt: { lte: now } },
      data: { sentAt: now, sendError: null },
    });
    if (claimed.count !== 1) continue;

    const app = await prisma.application.findUniqueOrThrow({ where: { id }, include: { job: true } });
    try {
      const { user, profile } = await loadCandidate(app.userId);
      const documents = app.matchId ? await prisma.document.findMany({ where: { matchId: app.matchId } }) : [];
      const result = await senderFor(app.route).send({ application: app, job: app.job, user, profile, documents });

      if (result.ok) {
        await prisma.$transaction([
          prisma.application.update({ where: { id }, data: { status: 'applied', scheduledSendAt: null } }),
          prisma.applicationEvent.create({
            data: { applicationId: id, type: 'applied', label: 'You approved and applied', detail: result.detail, occurredAt: now },
          }),
          ...(app.matchId ? [prisma.match.update({ where: { id: app.matchId }, data: { status: 'applied' } })] : []),
          ...Object.entries(result.pdfKeys ?? {}).map(([type, pdfKey]) =>
            prisma.document.updateMany({ where: { matchId: app.matchId ?? '', type: type as 'cv' | 'cover_letter' }, data: { pdfKey } }),
          ),
        ]);
        sent++;
      } else if (result.reason === 'not_supported') {
        // Form submission is not available yet: nothing was sent, so the user finishes on the employer's site.
        await prisma.$transaction([
          prisma.application.update({
            where: { id },
            data: { sentAt: null, scheduledSendAt: null, sendError: 'not_supported' },
          }),
          prisma.applicationEvent.create({
            data: {
              applicationId: id,
              type: 'finish_on_site',
              label: 'Ready for you to finish on their site',
              detail: 'We cannot submit this form for you yet. Nothing was sent.',
              occurredAt: now,
            },
          }),
        ]);
      } else {
        throw new Error(result.reason === 'failed' ? (result.message ?? 'failed') : result.reason);
      }
    } catch (err) {
      logger.error({ applicationId: id, err: (err as Error).message }, 'send failed');
      await prisma.$transaction([
        prisma.application.update({
          where: { id },
          data: { sentAt: null, scheduledSendAt: null, sendError: 'failed' },
        }),
        prisma.applicationEvent.create({
          data: { applicationId: id, type: 'send_failed', label: SEND_FAILED_MESSAGE, occurredAt: now },
        }),
      ]);
    }
  }
  return { due: due.length, sent };
}
