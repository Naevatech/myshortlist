import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, H, onboardedUser, signIn } from './helpers.js';
import { prisma } from '../src/utils/prisma.js';
import { asArray } from '../src/utils/json.js';
import { analyse, score, textView, type AtsState } from '../src/services/ats/analyse.js';
import { countKeyword, jobKeywords, KEYWORDS } from '../src/services/ats/keywords.js';
import type { Block, ProfileData } from '../src/types/domain.js';

const profile: ProfileData = {
  fullName: 'Sam Carter',
  email: 'sam.carter@example.com',
  phone: '07700 900123',
  location: 'Belfast',
  headline: 'Full-stack developer',
  summary: 'Full-stack developer with three years of experience.',
  experience: [
    { title: 'Full-Stack Developer', company: 'Brightwater Studio', start: '2024', end: '2025', bullets: ['Built a component library', 'Reviewed code', 'Ran releases'] },
  ],
  education: [{ qualification: 'BSc Computing', institution: 'Ulster University', start: '2018', end: '2022' }],
  skills: ['React', 'TypeScript', 'Node.js'],
};

const filler = Array.from({ length: 40 }, (_, i) => `Delivered feature ${i + 1} for customers using React and TypeScript.`).join('\n');

const GOOD_CV = `Sam Carter
sam.carter@example.com · 07700 900123 · Belfast
Summary
Full-stack developer with three years of experience building web applications.
Experience
Full-Stack Developer, Brightwater Studio Jan 2024 to Jan 2025
- Built a React and TypeScript component library used by 4 teams
Education
BSc Computing, Ulster University Sep 2018 to Jun 2022
Skills
React, TypeScript, Node.js, Jest
${filler}`;

const BAD_CV = `Sam Carter
Belfast
My Journey
Full-Stack Developer, Brightwater Studio 01/2024 - 2025
★ Built things
★ Did work
★ More work
Skills      React      Testing
Node.js     Library    TypeScript
REST        Accessibility   Git
Agile       Scrum      Jira
${filler}`;

const JOB = { title: 'Frontend Engineer', company: 'Halden & Moore', text: 'We need React, TypeScript, REST APIs, Jest, CI/CD and Agile. React daily. TypeScript everywhere. TypeScript! React.' };

const empty: AtsState = { fixed: [], ignored: [], added: [] };
const byId = (checks: ReturnType<typeof analyse>['checks']) => Object.fromEntries(checks.map((c) => [c.id, c]));

describe('keyword counting', () => {
  const def = (name: string) => KEYWORDS.find((k) => k.name === name)!;

  it('matches whole words and spellings, counting each place once', () => {
    expect(countKeyword(def('Node.js'), 'I use Node.js and nodejs, and node.')).toBe(3);
    expect(countKeyword(def('Java'), 'JavaScript only')).toBe(0);
    expect(countKeyword(def('C++'), 'C++ and C#')).toBe(1);
    expect(countKeyword(def('CI/CD'), 'Set up CI/CD and continuous integration')).toBe(2);
    expect(countKeyword(def('R'), 'r is a letter, R is a language')).toBe(1);
  });

  it('lists the job keywords with counts in the job and the CV, most mentioned first', () => {
    const kws = jobKeywords(JOB.text, 'React and Node.js developer');
    expect(kws[0]).toEqual({ k: 'React', job: 3, cv: 1 });
    expect(kws.find((w) => w.k === 'TypeScript')).toEqual({ k: 'TypeScript', job: 3, cv: 0 });
    expect(kws.map((w) => w.k)).toEqual(expect.arrayContaining(['REST APIs', 'Jest', 'CI/CD', 'Agile']));
  });
});

describe('analysis', () => {
  it('passes a clean, single-column CV with standard headings', () => {
    const { checks } = analyse({ text: GOOD_CV, profile, job: null });
    const c = byId(checks);
    for (const id of ['b_name', 'b_contact', 'b_location', 'b_dates', 's_exp', 's_skills', 's_edu', 's_summary', 'f_text', 'f_chars', 'f_columns']) {
      expect(c[id].sev, id).toBe('pass');
    }
    expect(c.k_missing).toBeUndefined();
  });

  it('flags missing contact details, odd headings, icons, columns and mixed dates', () => {
    const { checks } = analyse({ text: BAD_CV, profile, job: JOB });
    const c = byId(checks);
    expect(c.b_contact).toMatchObject({ sev: 'fail', fix: 'copy' });
    expect(c.s_exp).toMatchObject({ sev: 'warn', title: 'Heading "My Journey" may not be recognised', fixLabel: 'Rename to Experience' });
    expect(c.f_chars.sev).toBe('warn');
    expect(c.f_columns.sev).toBe('fail');
    expect(c.b_dates.sev).toBe('warn');
    expect(c.r_results.sev).toBe('warn');
    expect(c.k_missing).toMatchObject({ sev: 'fail', fix: 'keywords' });
  });

  it('raises the score as issues are fixed and keywords added', () => {
    const { checks, keywords } = analyse({ text: BAD_CV, profile, job: JOB });
    const start = score(checks, empty, keywords);
    const fixedSome = score(checks, { ...empty, fixed: ['b_contact', 'f_columns'] }, keywords);
    const withKeywords = score(checks, { ...empty, fixed: ['b_contact', 'f_columns'], added: ['CI/CD'] }, keywords);
    expect(fixedSome).toBeGreaterThan(start);
    expect(withKeywords).toBeGreaterThan(fixedSome);
    // Ignoring does not raise the score.
    expect(score(checks, { ...empty, ignored: ['b_contact'] }, keywords)).toBe(start);
  });

  it('marks problems in the plain text and shows the fixed lines', () => {
    const before = textView(BAD_CV, profile, empty);
    expect(before[1]).toEqual({ text: '[email and phone not found]', mark: 'bad' });
    expect(before.find((l) => l.text === 'My Journey')?.mark).toBe('bad');
    const after = textView(BAD_CV, profile, { ...empty, fixed: ['b_contact', 's_exp'] });
    expect(after[1]).toEqual({ text: 'sam.carter@example.com · 07700 900123', mark: 'good' });
    expect(after.find((l) => l.text === 'EXPERIENCE')?.mark).toBe('good');
  });
});

describe('ATS checker API', () => {
  async function userWithCv(text = BAD_CV) {
    const u = await onboardedUser();
    await prisma.cv.updateMany({ where: { userId: u.user.id }, data: { rawText: text } });
    return u;
  }

  it('offers the current CV and recent matches', async () => {
    const u = await userWithCv();
    const r = await u.agent.get('/api/tools/ats/setup').expect(200);
    expect(r.body.cv.fileName).toBe('cv.pdf');
    expect(r.body.jobs).toHaveLength(u.matches.length);
    expect(r.body.jobs[0]).toMatchObject({ foundDaysAgo: 0 });
  });

  it('checks the current CV against a match, and adding a keyword edits that job’s tailored CV', async () => {
    const u = await userWithCv();
    const r = await u.agent.post('/api/tools/ats/checks').set(H).field('cvSource', 'current').field('jobSource', 'match').field('matchId', u.form.id).expect(201);
    expect(r.body.copy).toBe('match');
    expect(r.body.areas.map((a: { id: string }) => a.id)).toEqual(['kw', 'sec', 'fmt', 'read', 'basic']);
    const missing = r.body.keywords.find((w: { cv: number }) => w.cv === 0);
    expect(missing).toBeTruthy();

    const added = await u.agent.post(`/api/tools/ats/checks/${r.body.id}/actions`).set(H).send({ action: 'add', keyword: missing.k }).expect(200);
    expect(added.body.score).toBeGreaterThan(r.body.score);
    expect(added.body.keywords.find((w: { k: string }) => w.k === missing.k).added).toBe(true);
    const doc = await prisma.document.findUniqueOrThrow({ where: { matchId_type: { matchId: u.form.id, type: 'cv' } } });
    const text = asArray<Block>(doc.blocksJson)
      .flatMap((b) => ('segments' in b ? b.segments : []))
      .map((s) => s.text)
      .join('');
    expect(text).toContain(missing.k);

    const undone = await u.agent.post(`/api/tools/ats/checks/${r.body.id}/actions`).set(H).send({ action: 'remove', keyword: missing.k }).expect(200);
    expect(undone.body.score).toBe(r.body.score);
  });

  it('fixes, undoes and ignores checks, and keeps the original score', async () => {
    const u = await userWithCv();
    const r = await u.agent.post('/api/tools/ats/checks').set(H).field('cvSource', 'current').field('jobSource', 'none').expect(201);
    expect(r.body.copy).toBe('download');
    expect(r.body.areas.map((a: { id: string }) => a.id)).not.toContain('kw');
    const act = (body: object) => u.agent.post(`/api/tools/ats/checks/${r.body.id}/actions`).set(H).send(body).expect(200);

    const fixed = await act({ action: 'fix', id: 'b_contact' });
    expect(fixed.body.score).toBeGreaterThan(r.body.score);
    expect(fixed.body.initialScore).toBe(r.body.score);
    expect(fixed.body.checks.find((c: { id: string }) => c.id === 'b_contact')).toMatchObject({ fixed: true, resolved: true });
    expect(fixed.body.fields.find((f: { label: string }) => f.label === 'Email')).toMatchObject({ value: u.email, ok: true });

    const undone = await act({ action: 'undo', id: 'b_contact' });
    expect(undone.body.score).toBe(r.body.score);
    const ignored = await act({ action: 'ignore', id: 'f_chars' });
    expect(ignored.body.remaining).toBe(r.body.remaining - 1);
    expect(ignored.body.score).toBe(r.body.score);
    // Advice-only checks cannot be "fixed" by Shortlist.
    await u.agent.post(`/api/tools/ats/checks/${r.body.id}/actions`).set(H).send({ action: 'fix', id: 'r_length' }).expect(400);

    const pdf = await u.agent.get(`/api/tools/ats/checks/${r.body.id}/pdf`).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
  });

  it('checks a pasted job, and refuses one that is too short', async () => {
    const u = await userWithCv(GOOD_CV);
    await u.agent.post('/api/tools/ats/checks').set(H).field('cvSource', 'current').field('jobSource', 'paste').field('jobText', 'Too short.').expect(400);
    const r = await u.agent
      .post('/api/tools/ats/checks')
      .set(H)
      .field('cvSource', 'current')
      .field('jobSource', 'paste')
      .field('jobText', `${JOB.text} ${'We value clear writing and teamwork across the product group. '.repeat(4)}`)
      .expect(201);
    expect(r.body.job.matchId).toBeNull();
    expect(r.body.keywords.length).toBeGreaterThan(3);
  });

  it('keeps checks private', async () => {
    const u = await userWithCv();
    const r = await u.agent.post('/api/tools/ats/checks').set(H).field('cvSource', 'current').field('jobSource', 'none').expect(201);
    const other = await signIn();
    await other.agent.get(`/api/tools/ats/checks/${r.body.id}`).expect(404);
    await request(app).get(`/api/tools/ats/checks/${r.body.id}`).expect(401);
  });
});

describe('location', () => {
  it('rejects a job title read as a place and finds the town near the top', async () => {
    const { findLocation } = await import('../src/services/ats/analyse.js');
    const text = 'Sam Carter\nFull-stack developer · Belfast, Northern Ireland · sam@example.com\nSummary';
    expect(findLocation(text, 'Full-stack developer', 'Belfast, Northern Ireland')).toBe('Belfast');
    expect(findLocation(text, 'Lisburn', 'Belfast')).toBe('Lisburn');
    expect(findLocation('Sam Carter\nSummary', '', 'Belfast')).toBe('');
  });
});
