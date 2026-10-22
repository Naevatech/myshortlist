import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, H, onboardedUser } from './helpers.js';
import { outbox } from '../src/services/email/index.js';
import { prisma } from '../src/utils/prisma.js';
import { purgeDeletedUsers } from '../src/jobs/dailyMatches.js';
import { ruleBasedParse } from '../src/services/cvParser.js';

describe('data export and account deletion', () => {
  it('exports everything held about the user', async () => {
    const u = await onboardedUser();
    const r = await u.agent.get('/api/me/export').expect(200);
    expect(r.headers['content-disposition']).toContain('shortlist-data.json');
    const data = JSON.parse(r.text);
    expect(data.account.email).toBe(u.email);
    expect(data.profile.fullName).toBe('Sam Carter');
    expect(data.preferences.location).toBe('Belfast');
    expect(data.matches.length).toBe(u.matches.length);
    expect(data.matches[0].documents).toHaveLength(2);
  });

  it('needs confirmation, blocks sign-in at once and purges later', async () => {
    const u = await onboardedUser();
    await u.agent.delete('/api/me').set(H).send({}).expect(400);
    await u.agent.delete('/api/me').set(H).send({ confirm: true }).expect(200);
    await u.agent.get('/api/me').expect(401);

    const before = outbox.length;
    await request(app).post('/api/auth/forgot').set(H).send({ email: u.email }).expect(202);
    expect(outbox.slice(before).some((m) => m.to === u.email)).toBe(false);
    await request(app).post('/api/auth/signin').set(H).send({ email: u.email, password: u.password }).expect(401);

    await purgeDeletedUsers(new Date(Date.now() + 8 * 86_400_000));
    expect(await prisma.user.findUnique({ where: { id: u.user.id } })).toBeNull();
    expect(await prisma.match.count({ where: { userId: u.user.id } })).toBe(0);
  });
});

describe('rule-based CV parser', () => {
  it('reads the main fields without an AI key', () => {
    const cv = ruleBasedParse(
      [
        'Sam Carter',
        'Full-stack developer',
        'Belfast | sam.carter@example.com | 07700 900123',
        'Summary',
        'Full-stack developer with three years of experience building customer-facing web applications for clients.',
        'Experience',
        'Full-Stack Developer, Brightwater Studio 2024 to 2025',
        '• Built a React and TypeScript component library',
        'Frontend Developer at Fernlea Agency, 2022 - 2024',
        '- Delivered responsive interfaces from Figma designs',
        'Education',
        'BSc Computing, Ulster University 2018 to 2022',
        'Skills',
        'React, TypeScript, Node.js, MongoDB',
      ].join('\n'),
    );
    expect(cv.name).toBe('Sam Carter');
    expect(cv.email).toBe('sam.carter@example.com');
    expect(cv.phone).toContain('07700');
    expect(cv.experience).toHaveLength(2);
    expect(cv.experience[0]).toMatchObject({ title: 'Full-Stack Developer', company: 'Brightwater Studio', start: '2024', end: '2025' });
    expect(cv.experience[1].company).toBe('Fernlea Agency');
    expect(cv.education[0].qualification).toBe('BSc Computing');
    expect(cv.skills).toEqual(['React', 'TypeScript', 'Node.js', 'MongoDB']);
    expect(cv.yearsExperience).toBe(3);
  });
});
