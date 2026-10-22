import { z } from 'zod';
import { env } from '../../config/env.js';
import { NotConfiguredError } from '../../utils/errors.js';
import type { JobProvider, JobSearch, RawJob } from './types.js';

/**
 * A generic provider for your own job API. It calls
 *   GET {JOBS_API_BASE_URL}/jobs?roles=a,b&location=..&radiusMiles=..&workModes=..&minSalary=..&limit=..
 * with "Authorization: Bearer {JOBS_API_KEY}" and expects `{ jobs: RawJob[] }`.
 * If your API returns another shape, change mapJob() below. Nothing else in the app needs to change.
 */
const rawJobSchema = z.object({
  externalId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  workMode: z.enum(['remote', 'hybrid', 'onsite']),
  workModeDetail: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  description: z.string(),
  requirements: z.array(z.string()).default([]),
  postedAt: z.string(),
  applyRoute: z.enum(['email', 'form', 'site']),
  applyUrl: z.string().url().optional(),
  applyEmail: z.string().email().optional(),
});

function mapJob(item: unknown): RawJob {
  return { ...rawJobSchema.parse(item), raw: item };
}

export class CustomProvider implements JobProvider {
  name = 'custom';

  async search(q: JobSearch): Promise<RawJob[]> {
    if (!env.JOBS_API_BASE_URL) throw new NotConfiguredError('JOB_PROVIDER=custom needs JOBS_API_BASE_URL in server/.env.');
    const url = new URL('/jobs', env.JOBS_API_BASE_URL);
    url.searchParams.set('roles', q.roles.join(','));
    url.searchParams.set('location', q.location);
    url.searchParams.set('radiusMiles', String(q.radiusMiles));
    url.searchParams.set('workModes', q.workModes.join(','));
    if (q.minSalary) url.searchParams.set('minSalary', String(q.minSalary));
    url.searchParams.set('limit', String(q.limit));
    url.searchParams.set('postedAfter', q.postedAfter.toISOString());
    url.searchParams.set('postedBefore', q.postedBefore.toISOString());
    const res = await fetch(url, {
      headers: env.JOBS_API_KEY ? { Authorization: `Bearer ${env.JOBS_API_KEY}` } : undefined,
    });
    if (!res.ok) throw new Error(`Job API responded with ${res.status}`);
    const body = (await res.json()) as { jobs?: unknown[] };
    return (body.jobs ?? []).map(mapJob);
  }
}
