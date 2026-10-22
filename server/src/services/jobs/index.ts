import type { Job } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { toJson } from '../../utils/json.js';
import { AdzunaProvider } from './adzuna.js';
import { CustomProvider } from './custom.js';
import { PlaceholderProvider } from './placeholder.js';
import { ReedProvider } from './reed.js';
import { MultiProvider } from './multi.js';
import type { JobProvider, JobSearch, RawJob } from './types.js';

export type { JobProvider, RawJob, JobSearch } from './types.js';

const DAY_MS = 86_400_000;

/** The posting window from JOBS_MAX_AGE_DAYS and JOBS_MIN_AGE_DAYS. */
export function jobWindow(now = new Date(), maxDays = env.JOBS_MAX_AGE_DAYS, minDays = env.JOBS_MIN_AGE_DAYS) {
  return {
    maxDays,
    minDays,
    postedAfter: new Date(now.getTime() - maxDays * DAY_MS),
    postedBefore: new Date(now.getTime() - minDays * DAY_MS),
  };
}

/** Whole days since posting (0 = today). Null when the date is missing or unreadable. */
export function ageInDays(postedAt: string | Date | null | undefined, now = new Date()): number | null {
  if (!postedAt) return null;
  const t = new Date(postedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

/**
 * Keeps jobs posted inside the window, newest first. Jobs with no usable date are dropped: a date is never
 * guessed. Run on every provider's results, because not every provider supports the filter.
 */
export function withinWindow(jobs: RawJob[], now = new Date(), w = jobWindow(now)): RawJob[] {
  return jobs
    .map((job) => ({ job, age: ageInDays(job.postedAt, now) }))
    .filter((x): x is { job: RawJob; age: number } => x.age !== null && x.age >= w.minDays && x.age <= w.maxDays && new Date(x.job.postedAt).getTime() <= now.getTime() + 60 * 60_000)
    .sort((a, b) => new Date(b.job.postedAt).getTime() - new Date(a.job.postedAt).getTime())
    .map((x) => x.job);
}

/** Searches the provider for jobs in the posting window, filtered again and sorted newest first. */
export async function searchRecentJobs(provider: JobProvider, q: Omit<JobSearch, 'postedAfter' | 'postedBefore'>, now = new Date()) {
  const w = jobWindow(now);
  const raws = await provider.search({ ...q, postedAfter: w.postedAfter, postedBefore: w.postedBefore });
  return withinWindow(raws, now, w);
}

/** Jobs posted on or before this date have aged out of the window. */
export const agedOutBefore = (now = new Date()) => new Date(now.getTime() - (env.JOBS_MAX_AGE_DAYS + 1) * DAY_MS);

/** Picks the provider from JOB_PROVIDER. Switching this value is the only change needed to go live. */
export function createJobProvider(name: string = env.JOB_PROVIDER): JobProvider {
  const names = name.split(',').map((n) => n.trim()).filter(Boolean);
  if (names.length > 1) return new MultiProvider(names.map((n) => createJobProvider(n)));
  switch (names[0]) {
    case 'adzuna':
      return new AdzunaProvider();
    case 'reed':
      return new ReedProvider();
    case 'custom':
      return new CustomProvider();
    case 'placeholder':
      return new PlaceholderProvider();
    default:
      throw new Error(`Unknown JOB_PROVIDER "${name}"`);
  }
}

let instance: JobProvider | undefined;
export function jobProvider(): JobProvider {
  instance ??= createJobProvider();
  return instance;
}

/** Stores fetched jobs (unique on provider + externalId) so matches always point at stored rows. */
export async function upsertJobs(defaultProvider: string, raws: RawJob[]): Promise<Job[]> {
  const out: Job[] = [];
  for (const r of raws) {
    const provider = r.provider ?? defaultProvider;
    const data = {
      title: r.title,
      company: r.company,
      location: r.location,
      workMode: r.workMode,
      workModeDetail: r.workModeDetail ?? null,
      salaryMin: r.salaryMin ?? null,
      salaryMax: r.salaryMax ?? null,
      description: r.description,
      requirementsJson: toJson(r.requirements),
      applyRoute: r.applyRoute,
      applyUrl: r.applyUrl ?? null,
      applyEmail: r.applyEmail ?? null,
      formSchemaJson: r.formSchema?.length ? toJson(r.formSchema) : undefined,
      postedAt: new Date(r.postedAt),
      rawJson: r.raw === undefined ? undefined : toJson(r.raw),
    };
    out.push(
      await prisma.job.upsert({
        where: { provider_externalId: { provider, externalId: r.externalId } },
        create: { provider, externalId: r.externalId, ...data },
        update: data,
      }),
    );
  }
  return out;
}
