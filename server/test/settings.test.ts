import { describe, expect, it } from 'vitest';
import { H, signIn } from './helpers.js';

describe('matches per day', () => {
  it.each([3, 5, 10, 15, 20, 25, 30])('accepts %i', async (n) => {
    const { agent } = await signIn();
    const r = await agent.patch('/api/settings').set(H).send({ matchesPerDay: n }).expect(200);
    expect(r.body.matchesPerDay).toBe(n);
  });

  it.each([0, 4, 12, 31, 50])('refuses %i', async (n) => {
    const { agent } = await signIn();
    await agent.patch('/api/settings').set(H).send({ matchesPerDay: n }).expect(400);
  });

  it('lists the options and the account details', async () => {
    const { agent } = await signIn();
    const r = await agent.get('/api/settings').expect(200);
    expect(r.body.matchesPerDayOptions).toEqual([3, 5, 10, 15, 20, 25, 30]);
    expect(r.body).toMatchObject({ matchesPerDay: 5, signInMethod: 'password', hasPassword: true });
    expect(r.body.passwordChangedAt).toBeTruthy();
  });
});
