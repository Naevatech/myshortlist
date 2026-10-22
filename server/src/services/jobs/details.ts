import type { Job } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { asObject, toJson } from '../../utils/json.js';
import { createJobProvider } from './index.js';

type Raw = Record<string, unknown> & { __full?: boolean; __detailsTried?: boolean; contract_type?: string; contract_time?: string };

/**
 * Some sources return only the start of an advert in search results. The first time a job is opened, ask the
 * source for the full advert (Reed has a details call; Adzuna does not). Failures leave the job as it was.
 */
export async function ensureFullDescription(job: Job): Promise<Job> {
  const raw = asObject<Raw>(job.rawJson, {});
  if (job.provider !== 'reed' || raw.__full || raw.__detailsTried) return job;
  try {
    const provider = createJobProvider('reed');
    const details = await provider.details?.(job.externalId);
    const rawJson = toJson({ ...raw, ...(details?.raw ?? {}), __full: Boolean(details), __detailsTried: true });
    return await prisma.job.update({
      where: { id: job.id },
      data: details && details.description.length > job.description.length ? { description: details.description, rawJson } : { rawJson },
    });
  } catch (err) {
    logger.warn({ jobId: job.id, err: (err as Error).message }, 'could not fetch the full advert');
    return job;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Contract type and hours, from whichever source fields exist. */
function contractOf(provider: string, raw: Raw): string | null {
  if (typeof raw.contract === 'string') return raw.contract;
  if (provider === 'adzuna') {
    const parts = [raw.contract_type, raw.contract_time].filter((x): x is string => typeof x === 'string').map((x) => x.replace('_', ' '));
    return parts.length ? cap(parts.join(', ')) : null;
  }
  if (provider === 'reed') {
    const hours = raw.fullTime ? 'full time' : raw.partTime ? 'part time' : '';
    const type = typeof raw.contractType === 'string' ? raw.contractType : '';
    const text = [type, hours].filter(Boolean).join(', ');
    return text ? cap(text) : null;
  }
  return null;
}

const SOURCE_NAME: Record<string, string> = { adzuna: 'Adzuna', reed: 'Reed' };

/** Extra facts for the full description on Job review. */
export function jobFacts(job: Job) {
  const raw = asObject<Raw>(job.rawJson, {});
  const source = SOURCE_NAME[job.provider] ?? null;
  return {
    contract: contractOf(job.provider, raw),
    reference: typeof raw.reference === 'string' ? raw.reference : source ? `${source} ${job.externalId}` : null,
    /** The source shares only the start of the advert (Adzuna always; Reed if the full advert could not be fetched). */
    partial: job.provider === 'adzuna' || (job.provider === 'reed' && !raw.__full),
    sourceName: source,
  };
}
