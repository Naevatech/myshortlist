import { describe, expect, it } from 'vitest';
import { H, onboardedUser } from './helpers.js';
import { prisma } from '../src/utils/prisma.js';
import { ukToday } from '../src/utils/dates.js';
import { purgeOldMatches } from '../src/jobs/dailyMatches.js';
import { earlierStatus } from '../src/modules/matches/routes.js';

const DAY = 86_400_000;

/** Moves a match to an earlier day, and its job's posting date back by `postedDaysAgo`. */
async function backdate(matchId: string, foundDaysAgo: number, postedDaysAgo: number) {
  const m = await prisma.match.update({
    where: { id: matchId },
    data: { matchedOn: new Date(ukToday().getTime() - foundDaysAgo * DAY) },
  });
  await prisma.job.update({ where: { id: m.jobId }, data: { postedAt: new Date(Date.now() - postedDaysAgo * DAY) } });
}

describe('earlierStatus', () => {
  it('works out applied, started, skipped and not applied', () => {
    expect(earlierStatus({ status: 'applied', startedAt: null }, undefined)).toBe('applied');
    expect(earlierStatus({ status: 'viewed', startedAt: null }, { status: 'interview' })).toBe('applied');
    expect(earlierStatus({ status: 'viewed', startedAt: null }, { status: 'approved' })).toBe('started');
    expect(earlierStatus({ status: 'viewed', startedAt: new Date() }, undefined)).toBe('started');
    expect(earlierStatus({ status: 'skipped', startedAt: null }, undefined)).toBe('skipped');
    expect(earlierStatus({ status: 'saved', startedAt: null }, undefined)).toBe('not');
  });
});

describe('Earlier tab', () => {
  it('groups past matches by day, newest first, with statuses, counts and expiry warnings', async () => {
    const u = await onboardedUser();
    const [a, b, c, d] = u.matches;
    await backdate(a.id, 1, 3);
    await backdate(b.id, 1, 18.5); // 2.5 days left of 21: warned as 2
    await backdate(c.id, 4, 5);
    await prisma.match.update({ where: { id: b.id }, data: { status: 'skipped' } });
    await u.agent.post(`/api/matches/${c.id}/start`).set(H).expect(200);
    // d stays on today: not part of Earlier.

    const r = await u.agent.get('/api/matches/earlier').expect(200);
    expect(r.body.retentionDays).toBe(21);
    expect(r.body.counts).toEqual({ all: 3, not: 1, applied: 0, started: 1, skipped: 1 });
    expect(r.body.days.map((g: { items: unknown[] }) => g.items.length)).toEqual([2, 1]);
    expect(r.body.days[0].date > r.body.days[1].date).toBe(true);
    const items = r.body.days.flatMap((g: { items: Array<{ id: string }> }) => g.items);
    const byId = Object.fromEntries(items.map((i: { id: string }) => [i.id, i]));
    expect(byId[b.id]).toMatchObject({ status: 'skipped', expiresInDays: 2 });
    expect(byId[a.id]).toMatchObject({ status: 'not', expiresInDays: null });
    expect(byId[c.id]).toMatchObject({ status: 'started', expiresInDays: null });
    expect(byId[d.id]).toBeUndefined();
  });

  it('links applied matches to their application', async () => {
    const u = await onboardedUser();
    await u.agent.post(`/api/matches/${u.site.id}/applied-on-site`).set(H).expect(200);
    await backdate(u.site.id, 2, 4);
    const r = await u.agent.get('/api/matches/earlier').expect(200);
    const item = r.body.days[0].items[0];
    expect(item.status).toBe('applied');
    expect(item.applicationId).toBeTruthy();
    expect(r.body.counts.applied).toBe(1);
  });
});

describe('removing old matches', () => {
  it('removes matches older than the retention period, but never applied or started ones', async () => {
    const u = await onboardedUser();
    const [old, oldSkipped, oldStarted, fresh] = u.matches;
    await u.agent.post(`/api/matches/${u.site.id}/applied-on-site`).set(H).expect(200);
    for (const m of [old, oldSkipped, oldStarted, u.site]) await backdate(m.id, 20, 25);
    await backdate(fresh.id, 2, 10);
    await prisma.match.update({ where: { id: oldSkipped.id }, data: { status: 'skipped' } });
    await prisma.match.update({ where: { id: oldStarted.id }, data: { startedAt: new Date() } });

    await purgeOldMatches();
    const left = new Set((await prisma.match.findMany({ where: { userId: u.user.id }, select: { id: true } })).map((m) => m.id));
    expect(left.has(old.id)).toBe(false);
    expect(left.has(oldSkipped.id)).toBe(false);
    expect(left.has(oldStarted.id)).toBe(true);
    expect(left.has(u.site.id)).toBe(true);
    expect(left.has(fresh.id)).toBe(true);
    // The applied job is still there for Applications.
    expect((await u.agent.get('/api/applications').expect(200)).body).toHaveLength(1);
  });
});
