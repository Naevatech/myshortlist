import { env } from '../config/env.js';
import { jobProvider, retentionCutoff, searchRecentJobs, upsertJobs } from '../services/jobs/index.js';
import { scoreMatch } from '../services/matching.js';
import { generateForMatch } from '../services/documents.js';
import { loadCandidate } from '../services/profileData.js';
import { email } from '../services/email/index.js';
import { newMatchesEmail } from '../services/email/templates.js';
import { prisma } from '../utils/prisma.js';
import { toJson } from '../utils/json.js';
import { ukToday } from '../utils/dates.js';
import { logger } from '../utils/logger.js';

/**
 * Finds new jobs for one user, keeps the best `matchesPerDay` they have not seen, and writes their documents.
 * Returns how many matches were created.
 */
export async function generateMatchesForUser(userId: string, opts: { notify?: boolean; now?: Date } = {}) {
  const { user, profile, prefs } = await loadCandidate(userId);
  if (user.deletedAt) return 0;
  const today = ukToday(opts.now);

  const alreadyToday = await prisma.match.count({ where: { userId, matchedOn: today } });
  const room = user.matchesPerDay - alreadyToday;
  if (room <= 0) return 0;

  const provider = jobProvider();
  // Only jobs inside the posting window, newest first. Anything outside it is skipped.
  const raws = await searchRecentJobs(
    provider,
    {
      roles: prefs.roles,
      location: prefs.location,
      radiusMiles: prefs.radiusMiles,
      workModes: prefs.workStyles,
      minSalary: prefs.minSalary ?? undefined,
      limit: Math.max(user.matchesPerDay * 3, 10),
    },
    opts.now,
  );
  const jobs = await upsertJobs(provider.name, raws);

  const seen = new Set(
    (await prisma.match.findMany({ where: { userId }, select: { jobId: true } })).map((m) => m.jobId),
  );
  const fresh = jobs.filter((j) => !seen.has(j.id));
  const scored = [];
  for (const job of fresh) scored.push({ job, result: await scoreMatch(profile, prefs, job) });
  scored.sort((a, b) => b.result.score - a.result.score);

  let created = 0;
  for (const { job, result } of scored.slice(0, room)) {
    const match = await prisma.match.create({
      data: {
        userId,
        jobId: job.id,
        score: result.score,
        reasonsJson: toJson(result.reasons),
        reasonLine: result.reasonLine,
        matchedOn: today,
      },
    });
    await generateForMatch(match.id, job, profile, prefs);
    created++;
  }

  if (created && opts.notify && user.notifyNewMatches) {
    await email().send(newMatchesEmail(user.email, created));
  }
  return created;
}

/** The morning run for every onboarded user. Also purges accounts deleted more than seven days ago. */
export async function runDailyMatches(now = new Date()) {
  const removed = await purgeOldMatches(now);
  const users = await prisma.user.findMany({
    where: { onboardingCompletedAt: { not: null }, deletedAt: null },
    select: { id: true },
  });
  let total = 0;
  for (const u of users) {
    try {
      total += await generateMatchesForUser(u.id, { notify: true, now });
    } catch (err) {
      logger.error({ userId: u.id, err: (err as Error).message }, 'daily matches failed for a user');
    }
  }
  const purged = await purgeDeletedUsers(now);
  logger.info({ users: users.length, matches: total, removed, purged, provider: env.JOB_PROVIDER }, 'daily matches done');
  return { users: users.length, matches: total, removed, purged };
}

/**
 * Removes matches whose job was posted more than JOB_RETENTION_DAYS ago. Matches the person applied to or started
 * are kept, and so is any job with an application, so Applications keeps its copy of the job.
 */
export async function purgeOldMatches(now = new Date()) {
  const cutoff = retentionCutoff(now);
  const res = await prisma.match.deleteMany({
    where: {
      job: { postedAt: { lt: cutoff } },
      status: { not: 'applied' },
      startedAt: null,
      applications: { none: { undoneAt: null } },
    },
  });
  // Jobs nobody is matched to or applied to any more.
  await prisma.job.deleteMany({ where: { postedAt: { lt: cutoff }, matches: { none: {} }, applications: { none: {} } } });
  return res.count;
}

/** Hard-deletes accounts that were soft-deleted at least seven days ago (well within the 30 days we promise). */
export async function purgeDeletedUsers(now = new Date()) {
  const { storage } = await import('../services/storage/index.js');
  const cutoff = new Date(now.getTime() - 7 * 86_400_000);
  const users = await prisma.user.findMany({ where: { deletedAt: { lte: cutoff } }, select: { id: true } });
  for (const u of users) {
    const [cvs, docs] = await Promise.all([
      prisma.cv.findMany({ where: { userId: u.id }, select: { fileKey: true } }),
      prisma.document.findMany({ where: { match: { userId: u.id }, pdfKey: { not: null } }, select: { pdfKey: true } }),
    ]);
    const apps = await prisma.application.findMany({ where: { userId: u.id }, select: { id: true } });
    const keys = [
      ...cvs.map((c) => c.fileKey),
      ...docs.map((d) => d.pdfKey!),
      ...apps.flatMap((a) => [`sent/${u.id}/${a.id}/cv.pdf`, `sent/${u.id}/${a.id}/cover-letter.pdf`]),
    ];
    for (const k of keys) await storage().delete(k).catch(() => undefined);
    await prisma.auditLog.updateMany({ where: { userId: u.id }, data: { userId: null } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  return users.length;
}
