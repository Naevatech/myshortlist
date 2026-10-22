import { describe, expect, it } from 'vitest';
import { H, onboardedUser, signIn } from './helpers.js';
import { prisma } from '../src/utils/prisma.js';
import { processScheduledSends } from '../src/jobs/processScheduledSends.js';
import { outbox } from '../src/services/email/index.js';

const later = (s: number) => new Date(Date.now() + s * 1000);
const key = () => `test-${Math.random().toString(36).slice(2)}-${Date.now()}`;

describe('approve, undo and scheduled sending', () => {
  it('cannot be sent before scheduledSendAt, is sent once after it, and never twice', async () => {
    const u = await onboardedUser();
    const res = await u.agent.post(`/api/matches/${u.email_.id}/approve`).set(H).send({ idempotencyKey: key() }).expect(201);
    const id = res.body.applicationId;
    const scheduled = new Date(res.body.scheduledSendAt).getTime();
    expect(scheduled - Date.now()).toBeGreaterThan(8_000);

    await processScheduledSends(new Date());
    const app = await prisma.application.findUniqueOrThrow({ where: { id } });
    expect(app.sentAt).toBeNull();
    expect(app.status).toBe('approved');

    const before = outbox.length;
    await processScheduledSends(later(11));
    await processScheduledSends(later(12));
    const sentApp = await prisma.application.findUniqueOrThrow({ where: { id }, include: { events: true } });
    expect(sentApp.status).toBe('applied');
    expect(sentApp.sentAt).not.toBeNull();
    expect(sentApp.events.filter((e) => e.type === 'applied')).toHaveLength(1);
    expect(sentApp.events[0].detail).toBe('dryRun');
    expect(outbox.slice(before).filter((m) => m.subject.startsWith('Application for'))).toHaveLength(1);
    expect((await prisma.match.findUniqueOrThrow({ where: { id: u.email_.id } })).status).toBe('applied');

    // Too late to undo now.
    await u.agent.post(`/api/applications/${id}/undo`).set(H).expect(409);
  });

  it('is idempotent', async () => {
    const u = await onboardedUser();
    const k = key();
    const a = await u.agent.post(`/api/matches/${u.email_.id}/approve`).set(H).send({ idempotencyKey: k }).expect(201);
    const b = await u.agent.post(`/api/matches/${u.email_.id}/approve`).set(H).send({ idempotencyKey: k }).expect(200);
    const c = await u.agent.post(`/api/matches/${u.email_.id}/approve`).set(H).send({ idempotencyKey: key() }).expect(200);
    expect(b.body.applicationId).toBe(a.body.applicationId);
    expect(c.body.applicationId).toBe(a.body.applicationId);
    expect(await prisma.application.count({ where: { matchId: u.email_.id } })).toBe(1);
  });

  it('is never sent after undo', async () => {
    const u = await onboardedUser();
    const res = await u.agent.post(`/api/matches/${u.email_.id}/approve`).set(H).send({ idempotencyKey: key() }).expect(201);
    await u.agent.post(`/api/applications/${res.body.applicationId}/undo`).set(H).expect(200);
    await processScheduledSends(later(30));
    const app = await prisma.application.findUniqueOrThrow({ where: { id: res.body.applicationId } });
    expect(app.sentAt).toBeNull();
    expect(app.undoneAt).not.toBeNull();
    expect(app.status).toBe('approved');
    // Undone applications are not listed, and the job can be approved again.
    const list = await u.agent.get('/api/applications').expect(200);
    expect(list.body.find((a: { id: string }) => a.id === app.id)).toBeUndefined();
    await u.agent.post(`/api/matches/${u.email_.id}/approve`).set(H).send({ idempotencyKey: key() }).expect(201);
  });

  it('only lets the owner approve', async () => {
    const u = await onboardedUser();
    const other = await signIn();
    await other.agent.post(`/api/matches/${u.email_.id}/approve`).set(H).send({ idempotencyKey: key() }).expect(404);
    await other.agent.get(`/api/matches/${u.email_.id}`).expect(404);
  });
});

describe('route rules', () => {
  it('blocks a form approval while answers need attention, then falls back to finishing on site', async () => {
    const u = await onboardedUser();
    const answers = await u.agent.get(`/api/matches/${u.form.id}/answers`).expect(200);
    const notice = answers.body.answers.find((a: { key: string }) => a.key === 'notice_period');
    expect(notice.needsAttention).toBe(true);
    expect(notice.hint).toBe('Needs your answer. We could not find this in your CV.');

    const blocked = await u.agent.post(`/api/matches/${u.form.id}/approve`).set(H).send({ idempotencyKey: key() }).expect(409);
    expect(blocked.body.error.code).toBe('answers_needed');

    await u.agent.put(`/api/matches/${u.form.id}/answers`).set(H).send({ answers: [{ key: 'notice_period', value: 'One month' }] }).expect(200);
    const ok = await u.agent.post(`/api/matches/${u.form.id}/approve`).set(H).send({ idempotencyKey: key() }).expect(201);

    await processScheduledSends(later(11));
    const app = await prisma.application.findUniqueOrThrow({ where: { id: ok.body.applicationId } });
    expect(app.status).toBe('approved');
    expect(app.sentAt).toBeNull();
    expect(app.sendError).toBe('not_supported');

    const site = await u.agent.post(`/api/matches/${u.form.id}/applied-on-site`).set(H).expect(200);
    expect(site.body.id).toBe(app.id);
    expect(site.body.status).toBe('applied');
    expect(site.body.route).toBe('site');
  });

  it('never sends anything for the site route', async () => {
    const u = await onboardedUser();
    await u.agent.post(`/api/matches/${u.site.id}/approve`).set(H).send({ idempotencyKey: key() }).expect(400);
    const res = await u.agent.post(`/api/matches/${u.site.id}/applied-on-site`).set(H).expect(200);
    const app = await prisma.application.findUniqueOrThrow({ where: { id: res.body.id }, include: { events: true } });
    expect(app.status).toBe('applied');
    expect(app.sentAt).toBeNull();
    expect(app.events[0].label).toBe("You applied on the employer's site");
  });

  it('gives every match a score and exactly three reasons', async () => {
    const u = await onboardedUser();
    for (const m of u.matches) {
      const r = await u.agent.get(`/api/matches/${m.id}`).expect(200);
      expect(r.body.score).toBeGreaterThanOrEqual(0);
      expect(r.body.reasons).toHaveLength(3);
      expect(r.body.documents.map((d: { type: string }) => d.type).sort()).toEqual(['cover_letter', 'cv']);
    }
  });
});
