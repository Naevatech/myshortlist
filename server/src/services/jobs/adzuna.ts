import { env } from '../../config/env.js';
import { NotConfiguredError } from '../../utils/errors.js';
import type { JobProvider, JobSearch, RawJob } from './types.js';
import { daysBack, dedupe, fetchJson, inferWorkMode, isoOrEmpty, MILES_TO_KM, remoteOnly, searchTerms, stripHtml } from './util.js';

/**
 * Adzuna (https://developer.adzuna.com), UK listings.
 *   GET https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id&app_key&what&where&distance(km)&salary_min&results_per_page
 * Adzuna returns a description snippet (about 500 characters) and a redirect link to apply.
 */
export interface AdzunaResult {
  id: string | number;
  title: string;
  description?: string;
  created?: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
}

export function mapAdzunaJob(r: AdzunaResult): RawJob {
  const description = stripHtml(r.description ?? '');
  const title = stripHtml(r.title);
  const predicted = String(r.salary_is_predicted ?? '0') === '1';
  const area = r.location?.area ?? [];
  return {
    externalId: String(r.id),
    title,
    company: r.company?.display_name?.trim() || 'Company not named',
    // The most specific place Adzuna gives, for example "Belfast" rather than "Belfast, County Antrim".
    location: area[area.length - 1] ?? r.location?.display_name?.split(',')[0]?.trim() ?? 'UK',
    workMode: inferWorkMode(`${title} ${description}`),
    // Adzuna estimates salaries it was not given. We only show real figures.
    salaryMin: predicted || !r.salary_min ? undefined : Math.round(r.salary_min),
    salaryMax: predicted || !r.salary_max ? undefined : Math.round(r.salary_max),
    description,
    requirements: [],
    postedAt: isoOrEmpty(r.created),
    applyRoute: 'site',
    applyUrl: r.redirect_url,
    raw: r,
  };
}

export class AdzunaProvider implements JobProvider {
  name = 'adzuna';

  constructor(private keys: { appId?: string; appKey?: string } = { appId: env.ADZUNA_APP_ID, appKey: env.ADZUNA_APP_KEY }) {}

  async search(q: JobSearch): Promise<RawJob[]> {
    const { appId, appKey } = this.keys;
    if (!appId || !appKey) {
      throw new NotConfiguredError('JOB_PROVIDER=adzuna needs ADZUNA_APP_ID and ADZUNA_APP_KEY in server/.env.');
    }
    const perTerm = Math.min(50, Math.max(10, q.limit));
    const batches = await Promise.all(
      searchTerms(q).map(async (what) => {
        const url = new URL('https://api.adzuna.com/v1/api/jobs/gb/search/1');
        url.searchParams.set('app_id', appId);
        url.searchParams.set('app_key', appKey);
        url.searchParams.set('what', what);
        url.searchParams.set('results_per_page', String(perTerm));
        url.searchParams.set('max_days_old', String(daysBack(q.postedAfter)));
        if (q.location && !remoteOnly(q)) {
          url.searchParams.set('where', q.location);
          url.searchParams.set('distance', String(Math.round(q.radiusMiles * MILES_TO_KM)));
        }
        if (q.minSalary) url.searchParams.set('salary_min', String(q.minSalary));
        const body = (await fetchJson(url, { headers: { Accept: 'application/json' } })) as { results?: AdzunaResult[] };
        return (body.results ?? []).map(mapAdzunaJob);
      }),
    );
    return dedupe(batches.flat(), q.limit);
  }
}
