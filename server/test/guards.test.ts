import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, H } from './helpers.js';
import { env } from '../src/config/env.js';
import { createJobProvider } from '../src/services/jobs/index.js';
import { AdzunaProvider } from '../src/services/jobs/adzuna.js';
import { ReedProvider } from '../src/services/jobs/reed.js';
import { NotConfiguredError } from '../src/utils/errors.js';

const PROTECTED: Array<[string, string]> = [
  ['get', '/api/me'],
  ['get', '/api/me/export'],
  ['delete', '/api/me'],
  ['post', '/api/me/email/request'],
  ['post', '/api/me/password/reset-link'],
  ['post', '/api/auth/logout-all'],
  ['post', '/api/cv'],
  ['get', '/api/cv/active'],
  ['post', '/api/onboarding/complete'],
  ['get', '/api/profile'],
  ['patch', '/api/profile'],
  ['get', '/api/preferences'],
  ['put', '/api/preferences'],
  ['get', '/api/matches/today'],
  ['get', '/api/matches/x'],
  ['post', '/api/matches/x/skip'],
  ['post', '/api/matches/x/save'],
  ['get', '/api/matches/x/documents'],
  ['post', '/api/matches/x/documents/regenerate'],
  ['get', '/api/matches/x/documents/zip'],
  ['get', '/api/matches/x/answers'],
  ['put', '/api/matches/x/answers'],
  ['post', '/api/matches/x/approve'],
  ['post', '/api/matches/x/applied-on-site'],
  ['put', '/api/documents/x'],
  ['get', '/api/documents/x/pdf'],
  ['get', '/api/applications'],
  ['get', '/api/applications/x'],
  ['post', '/api/applications/x/undo'],
  ['post', '/api/applications/x/retry'],
  ['patch', '/api/applications/x/notes'],
  ['get', '/api/settings'],
  ['patch', '/api/settings'],
];

describe('auth guards', () => {
  it.each(PROTECTED)('%s %s needs a session', async (method, path) => {
    const r = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path).set(H).send({});
    expect(r.status).toBe(401);
  });

  it('keeps public routes public', async () => {
    await request(app).get('/api/health').expect(200);
    const cfg = await request(app).get('/api/config').expect(200);
    expect(cfg.body).toHaveProperty('googleEnabled');
  });

  it('protects cron routes with the secret', async () => {
    await request(app).post('/api/cron/process-sends').expect(403);
    await request(app).post('/api/cron/process-sends').set('x-cron-secret', 'wrong').expect(403);
    await request(app).post('/api/cron/process-sends').set('x-cron-secret', env.CRON_SECRET).expect(200);
  });
});

describe('job provider switching', () => {
  it('uses the placeholder provider and always returns at least six jobs', async () => {
    const p = createJobProvider('placeholder');
    const jobs = await p.search({ roles: ['Nothing alike'], location: 'Nowhere', radiusMiles: 5, workModes: [], limit: 3, postedAfter: new Date(Date.now() - 14 * 86_400_000), postedBefore: new Date() });
    expect(p.name).toBe('placeholder');
    expect(jobs.length).toBeGreaterThanOrEqual(6);
  });

  it.each(['adzuna', 'reed', 'custom'])('switches to %s', (name) => {
    expect(createJobProvider(name).name).toBe(name);
  });

  it.each([
    ['adzuna', () => new AdzunaProvider({})],
    ['reed', () => new ReedProvider('')],
  ])('%s explains a missing key', async (_name, make) => {
    await expect(make().search({ roles: [], location: '', radiusMiles: 5, workModes: [], limit: 5, postedAfter: new Date(Date.now() - 14 * 86_400_000), postedBefore: new Date() })).rejects.toBeInstanceOf(NotConfiguredError);
  });

  it('rejects an unknown provider', () => {
    expect(() => createJobProvider('nope')).toThrow(/Unknown JOB_PROVIDER/);
  });
});
