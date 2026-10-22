/**
 * After switching JOB_PROVIDER to a real API: replaces each user's unreviewed placeholder matches with real ones.
 * Only matches for placeholder jobs that are new, viewed or saved, with no application, are removed.
 *
 *   npm run jobs:refresh -w server
 */
import { env } from '../config/env.js';
import { prisma } from '../utils/prisma.js';
import { generateMatchesForUser } from './dailyMatches.js';

async function main() {
  if (env.JOB_PROVIDER.split(',').every((p) => p === 'placeholder')) {
    console.log('JOB_PROVIDER is still "placeholder". Set it to adzuna, reed or custom first.');
    return;
  }
  const users = await prisma.user.findMany({
    where: { onboardingCompletedAt: { not: null }, deletedAt: null },
    select: { id: true, email: true },
  });
  for (const u of users) {
    const removed = await prisma.match.deleteMany({
      where: {
        userId: u.id,
        status: { in: ['new', 'viewed', 'saved'] },
        job: { provider: 'placeholder' },
        applications: { none: {} },
      },
    });
    let created = 0;
    try {
      created = await generateMatchesForUser(u.id, { notify: false });
    } catch (err) {
      console.log(`  could not fetch jobs: ${(err as Error).message}`);
    }
    console.log(`${u.email.replace(/(.{2}).*@/, '$1…@')}: removed ${removed.count} placeholder matches, added ${created} from ${env.JOB_PROVIDER}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
