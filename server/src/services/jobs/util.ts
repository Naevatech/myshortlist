import type { JobSearch, RawJob } from './types.js';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", pound: '£' };

/**
 * Job descriptions arrive as HTML. Keep the text and its shape, as plain markers the app can show:
 * "## " starts a heading line and "• " a bullet point.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n## $1\n')
    .replace(/<p[^>]*>\s*<(strong|b)>([\s\S]*?)<\/\1>\s*:?\s*<\/p>/gi, '\n## $2\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<(br|\/p|\/li|\/div|\/ul|\/ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&([a-z]+|#\d+);/gi, (m, e: string) => ENTITIES[e.toLowerCase()] ?? (e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : m))
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Listings rarely have a work-mode field, so read it from the text. */
export function inferWorkMode(text: string): RawJob['workMode'] {
  const t = text.toLowerCase();
  if (/\bhybrid\b|days? (a|per) week in the office|days? in the office/.test(t)) return 'hybrid';
  if (/\b(fully remote|100% remote|remote[- ]first|work from home|wfh|home[- ]based)\b|\bremote\b/.test(t)) return 'remote';
  return 'onsite';
}

/** Up to three of the user's roles, each searched on its own. */
export function searchTerms(q: JobSearch): string[] {
  const roles = [...new Set(q.roles.map((r) => r.trim()).filter(Boolean))].slice(0, 3);
  return roles.length ? roles : ['developer'];
}

/** Only searching remote roles: don't restrict by town. */
export const remoteOnly = (q: JobSearch) => q.workModes.length === 1 && q.workModes[0] === 'remote';

export function dedupe(jobs: RawJob[], limit: number): RawJob[] {
  const seen = new Set<string>();
  const out: RawJob[] = [];
  for (const j of jobs) {
    const key = `${j.provider ?? ''}:${j.externalId}`;
    // The same job listed on two sites: compare title, company and town, ignoring punctuation.
    const loose = `${j.title}|${j.company}|${j.location}`.toLowerCase().replace(/[^a-z0-9|]+/g, '');
    if (seen.has(key) || seen.has(loose)) continue;
    seen.add(key);
    seen.add(loose);
    out.push(j);
  }
  return out.slice(0, limit);
}

export async function fetchJson(url: URL | string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Job API responded with ${res.status}`);
  return res.json();
}

export const MILES_TO_KM = 1.609;
export const DAY_MS = 86_400_000;

/** A source date as ISO, or '' when it is missing or cannot be read. Never guess a date. */
export function isoOrEmpty(value: string | number | Date | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Whole days between the window start and now, for providers that filter by "days old". */
export const daysBack = (postedAfter: Date, now = new Date()) => Math.max(1, Math.ceil((now.getTime() - postedAfter.getTime()) / DAY_MS));
