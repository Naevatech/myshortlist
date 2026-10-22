import type { ApplicationStatus } from '@prisma/client';
import { prisma } from '../src/utils/prisma.js';
import { toJson } from '../src/utils/json.js';
import { ukToday } from '../src/utils/dates.js';
import { upsertJobs } from '../src/services/jobs/index.js';
import { placeholderJobs } from '../src/services/jobs/placeholder.js';
import { scoreDeterministic } from '../src/services/matching.js';
import { generateForMatch } from '../src/services/documents.js';
import { templateCv } from '../src/services/tailoring.js';
import { renderPdf } from '../src/services/pdf.js';
import { storage } from '../src/services/storage/index.js';
import { toPreferencesData, toProfileData } from '../src/services/profileData.js';
import type { Block } from '../src/types/domain.js';
import { hashPassword } from '../src/modules/auth/passwords.js';
import type { RawJob } from '../src/services/jobs/types.js';

const EMAIL = 'sam.carter@example.com';
/** Demo password, printed after seeding. Only for the local demo account. */
const DEMO_PASSWORD = 'Shortlist-demo-2026';

const experience = [
  {
    title: 'Full-Stack Developer',
    company: 'Brightwater Studio',
    start: '2024',
    end: '2025',
    bullets: [
      'Built a React and TypeScript component library used across four products',
      'Designed REST APIs in Node.js and Express with MongoDB',
      'Reduced page load times by splitting bundles and caching responses',
    ],
  },
  {
    title: 'Frontend Developer',
    company: 'Fernlea Agency',
    start: '2022',
    end: '2024',
    bullets: [
      'Delivered responsive interfaces from Figma designs',
      'Built Stripe payment integrations for client shops',
      'Shipped weekly releases with designers and product managers',
    ],
  },
];
const education = [{ qualification: 'BSc Computing', institution: 'Ulster University', start: '2018', end: '2022' }];
const skills = ['React', 'TypeScript', 'Node.js', 'MongoDB', 'Tailwind CSS', 'Git', 'Express', 'Stripe', 'REST APIs', 'Figma', 'Jest', 'HTML and CSS'];
const summary =
  'Full-stack developer with three years of experience building customer-facing web applications. Comfortable across the stack with Node.js and MongoDB.';

const d = (s: string) => new Date(`${s}T10:00:00.000Z`);

const PAST: Array<{
  job: RawJob;
  status: ApplicationStatus;
  applied: string;
  events: Array<{ at: string; label: string; detail?: string; type: string }>;
  notes?: string;
}> = [
  {
    job: { externalId: 'seed-1', title: 'Full-Stack Developer', company: 'Ferngate Systems', location: 'Belfast', workMode: 'hybrid', salaryMin: 47000, salaryMax: 55000, description: 'Ferngate Systems builds booking tools for sports clubs. You will work across React and Node.js.', requirements: ['React', 'Node.js', 'REST APIs', 'Hybrid in Belfast'], postedAt: '2026-10-08', applyRoute: 'email', applyEmail: 'jobs@ferngate.example' },
    status: 'applied',
    applied: '2026-10-12',
    events: [{ at: '2026-10-12', type: 'applied', label: 'You approved and applied', detail: 'Sent with the CV and cover letter below.' }],
  },
  {
    job: { externalId: 'seed-2', title: 'Software Engineer', company: 'Oakridge Software', location: 'Belfast', workMode: 'onsite', salaryMin: 50000, salaryMax: 58000, description: 'Oakridge Software makes accounting tools for small firms. You will build TypeScript services and React screens.', requirements: ['TypeScript', 'React', 'Testing', 'On-site in Belfast'], postedAt: '2026-10-05', applyRoute: 'email', applyEmail: 'careers@oakridge.example' },
    status: 'viewed',
    applied: '2026-10-09',
    events: [
      { at: '2026-10-09', type: 'applied', label: 'You approved and applied', detail: 'Sent with the CV and cover letter below.' },
      { at: '2026-10-13', type: 'viewed', label: 'Application viewed' },
    ],
  },
  {
    job: { externalId: 'seed-3', title: 'React Developer', company: 'Quay Street Digital', location: 'Belfast', workMode: 'hybrid', salaryMin: 45000, salaryMax: 52000, description: 'Quay Street Digital builds web apps for retailers. You will build React interfaces and work with clients.', requirements: ['React', 'TypeScript', 'Figma', 'Hybrid in Belfast'], postedAt: '2026-10-02', applyRoute: 'email', applyEmail: 'hello@quaystreet.example' },
    status: 'interview',
    applied: '2026-10-06',
    events: [
      { at: '2026-10-06', type: 'applied', label: 'You approved and applied', detail: 'Sent with the CV and cover letter below.' },
      { at: '2026-10-08', type: 'viewed', label: 'Application viewed' },
      { at: '2026-10-11', type: 'interview', label: 'Interview invitation received', detail: 'Quay Street Digital asked to arrange a call.' },
    ],
    notes: 'Call booked for Thursday 15 October at 2pm. Ask about the team structure.',
  },
  {
    job: { externalId: 'seed-4', title: 'Web Developer', company: 'Marlow & Reed', location: 'UK', workMode: 'remote', salaryMin: 46000, salaryMax: 53000, description: 'Marlow & Reed is a legal publisher. You will maintain its public websites.', requirements: ['JavaScript', 'React', 'Accessibility', 'Remote within the UK'], postedAt: '2026-09-28', applyRoute: 'email', applyEmail: 'jobs@marlowreed.example' },
    status: 'offer',
    applied: '2026-10-02',
    events: [
      { at: '2026-10-02', type: 'applied', label: 'You approved and applied', detail: 'Sent with the CV and cover letter below.' },
      { at: '2026-10-04', type: 'viewed', label: 'Application viewed' },
      { at: '2026-10-09', type: 'interview', label: 'Interview invitation received' },
      { at: '2026-10-16', type: 'offer', label: 'Offer received', detail: 'Marlow & Reed sent an offer by email.' },
    ],
  },
  {
    job: { externalId: 'seed-5', title: 'Frontend Developer', company: 'Brightwater Health', location: 'Belfast', workMode: 'hybrid', salaryMin: 44000, salaryMax: 50000, description: 'Brightwater Health builds patient booking tools. You will work on React screens.', requirements: ['React', 'Accessibility', 'Testing', 'Hybrid in Belfast'], postedAt: '2026-09-24', applyRoute: 'email', applyEmail: 'careers@brightwaterhealth.example' },
    status: 'rejected',
    applied: '2026-09-28',
    events: [
      { at: '2026-09-28', type: 'applied', label: 'You approved and applied', detail: 'Sent with the CV and cover letter below.' },
      { at: '2026-10-07', type: 'rejected', label: 'The employer decided not to go ahead' },
    ],
  },
  {
    job: { externalId: 'seed-6', title: 'Platform Engineer', company: 'Tern Analytics', location: 'UK', workMode: 'remote', salaryMin: 55000, salaryMax: 65000, description: 'Tern Analytics runs data pipelines for retailers. You will look after its Node.js services.', requirements: ['Node.js', 'Cloud hosting', 'Monitoring', 'Remote within the UK'], postedAt: '2026-09-20', applyRoute: 'email', applyEmail: 'jobs@tern.example' },
    status: 'rejected',
    applied: '2026-09-24',
    events: [
      { at: '2026-09-24', type: 'applied', label: 'You approved and applied', detail: 'Sent with the CV and cover letter below.' },
      { at: '2026-10-01', type: 'rejected', label: 'The employer decided not to go ahead' },
    ],
  },
];

async function main() {
  const old = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (old) await prisma.user.delete({ where: { id: old.id } });

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: 'Sam Carter',
      passwordHash: await hashPassword(DEMO_PASSWORD),
      passwordChangedAt: new Date(),
      emailVerifiedAt: new Date(),
      onboardingCompletedAt: new Date(),
      matchesPerDay: 5,
    },
  });

  const profileRow = await prisma.profile.create({
    data: {
      userId: user.id,
      fullName: 'Sam Carter',
      email: EMAIL,
      phone: '07700 900123',
      location: 'Belfast, Northern Ireland',
      headline: 'Full-stack developer',
      summary,
      experienceJson: toJson(experience),
      educationJson: toJson(education),
      skillsJson: toJson(skills),
    },
  });
  const prefsRow = await prisma.preferences.create({
    data: {
      userId: user.id,
      rolesJson: toJson(['Frontend Engineer', 'Full-Stack Developer', 'React Developer']),
      location: 'Belfast',
      radiusMiles: 15,
      workStylesJson: toJson(['hybrid']),
      minSalary: 45000,
      rightToWorkUk: true,
      needsSponsorship: false,
    },
  });
  const profile = toProfileData(profileRow);
  const prefs = toPreferencesData(prefsRow);

  // The CV file itself, so Profile can say where the details were read from.
  const cvBlocks: Block[] = templateCv(profile, { title: '', description: '', requirementsJson: [] } as never).map((b) =>
    'segments' in b ? { ...b, segments: b.segments.map((s) => ({ ...s, changed: false })) } : b,
  );
  const cvPdf = await renderPdf(cvBlocks, 'Sam Carter CV');
  const fileKey = `cv/${user.id}/seed.pdf`;
  await storage().put(fileKey, cvPdf, 'application/pdf');
  const rawText = [
    'Sam Carter',
    'Full-stack developer · Belfast, Northern Ireland · sam.carter@example.com · 07700 900123',
    'Summary',
    summary,
    'Experience',
    ...experience.flatMap((e) => [`${e.title}, ${e.company} ${e.start} to ${e.end}`, ...e.bullets.map((b) => `• ${b}`)]),
    'Education',
    'BSc Computing, Ulster University 2018 to 2022',
    'Skills',
    skills.join(', '),
  ].join('\n');
  await prisma.cv.create({
    data: {
      userId: user.id,
      fileKey,
      fileName: 'Sam-Carter-CV.pdf',
      mime: 'application/pdf',
      size: cvPdf.length,
      rawText,
      parsedJson: toJson({ name: 'Sam Carter', email: EMAIL, phone: '07700 900123', location: 'Belfast, Northern Ireland', headline: 'Full-stack developer', summary, experience, education, skills, yearsExperience: 3 }),
    },
  });

  // Today's matches: the six placeholder jobs.
  const jobs = await upsertJobs('placeholder', placeholderJobs());
  const today = ukToday();
  for (const job of jobs) {
    const r = scoreDeterministic(profile, prefs, job);
    const match = await prisma.match.create({
      data: { userId: user.id, jobId: job.id, score: r.score, reasonsJson: toJson(r.reasons), reasonLine: r.reasonLine, matchedOn: today },
    });
    await generateForMatch(match.id, job, profile, prefs);
  }

  // Applications for the tracker, each with its documents and the PDFs that were "sent".
  const pastJobs = await upsertJobs('seed', PAST.map((p) => p.job));
  for (const [i, p] of PAST.entries()) {
    const job = pastJobs[i];
    const r = scoreDeterministic(profile, prefs, job);
    const match = await prisma.match.create({
      data: {
        userId: user.id,
        jobId: job.id,
        score: r.score,
        reasonsJson: toJson(r.reasons),
        reasonLine: r.reasonLine,
        status: 'applied',
        matchedOn: d(p.applied),
      },
    });
    await generateForMatch(match.id, job, profile, prefs);
    const app = await prisma.application.create({
      data: {
        userId: user.id,
        matchId: match.id,
        jobId: job.id,
        route: 'email',
        status: p.status,
        approvedAt: d(p.applied),
        sentAt: d(p.applied),
        notes: p.notes ?? '',
        idempotencyKey: `seed-${user.id}-${i}`,
        events: { create: p.events.map((e) => ({ type: e.type, label: e.label, detail: e.detail, occurredAt: d(e.at) })) },
      },
    });
    for (const doc of await prisma.document.findMany({ where: { matchId: match.id } })) {
      const key = `sent/${user.id}/${app.id}/${doc.type === 'cv' ? 'cv' : 'cover-letter'}.pdf`;
      await storage().put(key, await renderPdf(doc.blocksJson as Block[], doc.type), 'application/pdf');
      await prisma.document.update({ where: { id: doc.id }, data: { pdfKey: key } });
    }
  }

  console.log(`Seeded ${EMAIL}: ${jobs.length} matches for today and ${PAST.length} applications.`);
  console.log(`Sign in with ${EMAIL} and the password ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
