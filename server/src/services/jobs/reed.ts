import { env } from '../../config/env.js';
import { NotConfiguredError } from '../../utils/errors.js';
import type { JobProvider, JobSearch, RawJob } from './types.js';
import { daysBack, dedupe, fetchJson, inferWorkMode, remoteOnly, searchTerms, stripHtml } from './util.js';

/**
 * Reed (https://www.reed.co.uk/developers), UK listings.
 *   GET https://www.reed.co.uk/api/1.0/search?keywords&locationName&distanceFromLocation(miles)&minimumSalary&resultsToTake
 *   Basic auth: username = REED_API_KEY, empty password.
 * Search results carry a description snippet and a link to apply on Reed.
 */
export interface ReedResult {
  jobId: number | string;
  employerName?: string;
  jobTitle: string;
  locationName?: string;
  minimumSalary?: number | null;
  maximumSalary?: number | null;
  date?: string; // DD/MM/YYYY
  jobDescription?: string;
  jobUrl: string;
}

/** Reed's minimum below this is a day or hour rate, not a yearly salary. */
const LOWEST_ANNUAL = 5000;

function reedDate(d?: string): string {
  const m = d && /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return '';
  const date = new Date(`${m[3]}-${m[2]}-${m[1]}T09:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function mapReedJob(r: ReedResult): RawJob {
  const description = stripHtml(r.jobDescription ?? '');
  const annual = (n?: number | null) => (n && n >= LOWEST_ANNUAL ? Math.round(n) : undefined);
  return {
    externalId: String(r.jobId),
    title: stripHtml(r.jobTitle),
    company: r.employerName?.trim() || 'Company not named',
    location: r.locationName?.trim() || 'UK',
    workMode: inferWorkMode(`${r.jobTitle} ${r.locationName ?? ''} ${description}`),
    salaryMin: annual(r.minimumSalary),
    salaryMax: annual(r.maximumSalary),
    description,
    requirements: [],
    postedAt: reedDate(r.date),
    applyRoute: 'site',
    applyUrl: r.jobUrl,
    raw: r,
  };
}

export class ReedProvider implements JobProvider {
  name = 'reed';

  constructor(private apiKey: string | undefined = env.REED_API_KEY) {}

  /** GET /api/1.0/jobs/{id}: the full advert, contract type and hours. */
  async details(externalId: string) {
    if (!this.apiKey || !/^\d+$/.test(externalId)) return null;
    const auth = `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`;
    const d = (await fetchJson(`https://www.reed.co.uk/api/1.0/jobs/${externalId}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })) as { jobDescription?: string; contractType?: string; fullTime?: boolean; partTime?: boolean; externalUrl?: string };
    const description = stripHtml(d.jobDescription ?? '');
    if (!description) return null;
    return { description, raw: { contractType: d.contractType, fullTime: d.fullTime, partTime: d.partTime, externalUrl: d.externalUrl } };
  }

  async search(q: JobSearch): Promise<RawJob[]> {
    if (!this.apiKey) throw new NotConfiguredError('JOB_PROVIDER=reed needs REED_API_KEY in server/.env.');
    const auth = `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`;
    const take = Math.min(100, Math.max(10, q.limit));
    const batches = await Promise.all(
      searchTerms(q).map(async (keywords) => {
        const url = new URL('https://www.reed.co.uk/api/1.0/search');
        url.searchParams.set('keywords', keywords);
        url.searchParams.set('resultsToTake', String(take));
        url.searchParams.set('postedWithin', String(daysBack(q.postedAfter)));
        if (q.location && !remoteOnly(q)) {
          url.searchParams.set('locationName', q.location);
          url.searchParams.set('distanceFromLocation', String(q.radiusMiles));
        }
        if (q.minSalary) url.searchParams.set('minimumSalary', String(q.minSalary));
        const body = (await fetchJson(url, { headers: { Authorization: auth, Accept: 'application/json' } })) as { results?: ReedResult[] };
        return (body.results ?? []).map(mapReedJob);
      }),
    );
    return dedupe(batches.flat(), q.limit);
  }
}
