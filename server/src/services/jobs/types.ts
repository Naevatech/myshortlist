import type { FormQuestion } from '../../types/domain.js';

export interface RawJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  /** Optional detail shown after the work mode, for example "three days in the office". */
  workModeDetail?: string;
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  requirements: string[];
  /** ISO date. An empty string means the source gave no date, and the job is dropped. */
  postedAt: string;
  applyRoute: 'email' | 'form' | 'site';
  applyUrl?: string;
  applyEmail?: string;
  /** Questions on the employer's form (route "form"). Empty means the default set is used. */
  formSchema?: FormQuestion[];
  raw?: unknown;
  /** Set when several sources are combined, so each job is stored under its own source. */
  provider?: string;
}

export interface JobSearch {
  roles: string[];
  location: string;
  radiusMiles: number;
  workModes: string[];
  minSalary?: number;
  limit: number;
  /** Only jobs posted in this window. Providers map it to their own filter; results are checked again after. */
  postedAfter: Date;
  postedBefore: Date;
}

export interface JobProvider {
  name: string;
  search(q: JobSearch): Promise<RawJob[]>;
  /** Optional: the full advert, for sources whose search results carry only a snippet. */
  details?(externalId: string): Promise<{ description: string; raw: Record<string, unknown> } | null>;
}
