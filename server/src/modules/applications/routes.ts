import { Router } from 'express';
import { z } from 'zod';
import type { ApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { notFound } from '../../utils/errors.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { parseQuery, validateBody } from '../../middleware/validate.js';
import { applicationBrief, jobView } from '../matches/views.js';
import { retrySend, undoApplication } from './service.js';

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

const ACTIVE: ApplicationStatus[] = ['applied', 'viewed', 'interview', 'offer'];
const CLOSED: ApplicationStatus[] = ['rejected', 'withdrawn'];

/**
 * Listed: anything sent or applied, plus approved applications that need the user (send failed, or finish on
 * their site). Approvals still inside the undo window are not listed.
 */
function listWhere(userId: string, filter: 'all' | 'active' | 'closed'): Prisma.ApplicationWhereInput {
  const needsUser: Prisma.ApplicationWhereInput = { status: 'approved', sendError: { not: null } };
  const base = { userId, undoneAt: null };
  if (filter === 'active') return { ...base, OR: [{ status: { in: ACTIVE } }, needsUser] };
  if (filter === 'closed') return { ...base, status: { in: CLOSED } };
  return { ...base, OR: [{ status: { in: [...ACTIVE, ...CLOSED] } }, needsUser] };
}

applicationsRouter.get('/', async (req, res) => {
  const { filter } = parseQuery(z.object({ filter: z.enum(['all', 'active', 'closed']).default('all') }), req);
  const apps = await prisma.application.findMany({
    where: listWhere(currentUser(req).id, filter),
    include: { job: true },
    orderBy: { approvedAt: 'desc' },
  });
  res.json(
    apps.map((a) => ({
      ...applicationBrief(a),
      approvedAt: a.approvedAt,
      matchId: a.matchId,
      job: jobView(a.job),
    })),
  );
});

applicationsRouter.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const app = await prisma.application.findUnique({
    where: { id: String(req.params.id) },
    include: { job: true, events: { orderBy: { occurredAt: 'desc' } } },
  });
  if (!app || app.userId !== user.id || app.undoneAt) throw notFound('We could not find this application.');
  const documents = app.matchId
    ? await prisma.document.findMany({ where: { matchId: app.matchId }, orderBy: { type: 'asc' } })
    : [];
  res.json({
    ...applicationBrief(app),
    approvedAt: app.approvedAt,
    matchId: app.matchId,
    notes: app.notes,
    job: jobView(app.job),
    events: app.events.map((e) => ({ id: e.id, type: e.type, label: e.label, detail: e.detail, occurredAt: e.occurredAt })),
    documents: documents.map((d) => ({ id: d.id, type: d.type, sent: Boolean(d.pdfKey), updatedAt: d.updatedAt })),
  });
});

applicationsRouter.post('/:id/undo', async (req, res) => {
  await undoApplication(currentUser(req).id, String(req.params.id));
  res.json({ ok: true });
});

applicationsRouter.post('/:id/retry', async (req, res) => {
  const app = await retrySend(currentUser(req).id, String(req.params.id));
  res.json(applicationBrief(app));
});

applicationsRouter.patch('/:id/notes', validateBody(z.object({ notes: z.string().max(10_000) })), async (req, res) => {
  const user = currentUser(req);
  const app = await prisma.application.findUnique({ where: { id: String(req.params.id) } });
  if (!app || app.userId !== user.id) throw notFound('We could not find this application.');
  await prisma.application.update({ where: { id: app.id }, data: { notes: req.body.notes } });
  res.json({ ok: true, notes: req.body.notes });
});
