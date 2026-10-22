import { logger } from '../../utils/logger.js';
import type { JobProvider, JobSearch, RawJob } from './types.js';
import { dedupe } from './util.js';

/**
 * Several sources at once (JOB_PROVIDER=adzuna,reed). Each is searched in parallel; results alternate between
 * sources so each is represented, and a job listed on both appears once. One source failing does not stop the
 * others; only if every source fails is the error passed on.
 */
export class MultiProvider implements JobProvider {
  name: string;

  constructor(private providers: JobProvider[]) {
    this.name = providers.map((p) => p.name).join('+');
  }

  async search(q: JobSearch): Promise<RawJob[]> {
    const settled = await Promise.allSettled(this.providers.map((p) => p.search(q)));
    const lists: RawJob[][] = [];
    settled.forEach((r, i) => {
      const provider = this.providers[i].name;
      if (r.status === 'fulfilled') lists.push(r.value.map((j) => ({ ...j, provider: j.provider ?? provider })));
      else logger.warn({ provider, err: (r.reason as Error)?.message }, 'job source failed');
    });
    if (!lists.length) {
      const first = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      throw first?.reason ?? new Error('No job sources returned results');
    }

    const interleaved: RawJob[] = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) {
      for (const l of lists) if (i < l.length) interleaved.push(l[i]);
    }
    return dedupe(interleaved, q.limit);
  }
}
