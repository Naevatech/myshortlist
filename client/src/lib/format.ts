import type { ApplicationBrief, ApplyRoute, JobSummary, WorkMode } from './types';

const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

export function formatSalary(min: number | null, max: number | null): string {
  if (min && max) return min === max ? gbp(min) : `${gbp(min)} to ${gbp(max)}`;
  if (min) return `From ${gbp(min)}`;
  if (max) return `Up to ${gbp(max)}`;
  return 'Salary not listed';
}

export const formatMoney = (n: number) => gbp(n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Oct 2026". Built by hand: some browsers format September as "Sept". */
export function formatDate(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const MODE: Record<WorkMode, string> = { remote: 'remote', hybrid: 'hybrid', onsite: 'on-site' };
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Card line: "Belfast, hybrid" or "Remote, UK". */
export function placeShort(job: Pick<JobSummary, 'location' | 'workMode'>): string {
  return job.workMode === 'remote' ? `Remote, ${job.location}` : `${job.location}, ${MODE[job.workMode]}`;
}

/** Review line: "Belfast · Hybrid, three days in the office". */
export function placeLong(job: Pick<JobSummary, 'location' | 'workMode' | 'workModeDetail'>): string {
  const mode = capital(MODE[job.workMode]) + (job.workModeDetail ? `, ${job.workModeDetail}` : '');
  return job.workMode === 'remote' ? `${mode} · ${job.location}` : `${job.location} · ${mode}`;
}

export const workModeLabel = (m: WorkMode) => capital(MODE[m]);

/** Short label on job cards. */
export const ROUTE_CARD_LABEL: Record<ApplyRoute, string> = {
  email: 'Sent by email',
  form: 'Form filled for you',
  site: 'You finish on their site',
};

/** Bold label and explanation on Job review. */
export const ROUTE_INFO: Record<ApplyRoute, { label: string; note: string; primary: string }> = {
  email: {
    label: 'Applies by email',
    note: 'We email your CV and cover letter once you approve.',
    primary: 'Approve and apply',
  },
  form: {
    label: 'Applies through a form on their site',
    note: 'We fill in the form from your CV. You check the answers before approving.',
    primary: 'Review answers',
  },
  site: {
    label: 'You finish on their site',
    note: 'We prepare your documents. You submit the application yourself.',
    primary: 'Open application page',
  },
};

export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export type StatusTone = 'ok' | 'grey' | 'acc' | 'off' | 'warn';

/** Status word and dot. Red is never used for status. */
export function applicationStatus(a: Pick<ApplicationBrief, 'status' | 'sendError'>): { label: string; tone: StatusTone } {
  if (a.status === 'approved') {
    if (a.sendError === 'not_supported') return { label: 'Finish on their site', tone: 'warn' };
    if (a.sendError === 'failed') return { label: 'Not sent', tone: 'warn' };
    return { label: 'Approved', tone: 'grey' };
  }
  const map: Record<Exclude<ApplicationBrief['status'], 'approved'>, { label: string; tone: StatusTone }> = {
    applied: { label: 'Applied', tone: 'ok' },
    viewed: { label: 'Viewed', tone: 'grey' },
    interview: { label: 'Interview', tone: 'acc' },
    offer: { label: 'Offer', tone: 'ok' },
    rejected: { label: 'Rejected', tone: 'off' },
    withdrawn: { label: 'Withdrawn', tone: 'off' },
  };
  return map[a.status];
}

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function parseSalary(input: string): number | null {
  const digits = input.replace(/[^\d.]/g, '');
  if (!digits) return null;
  let n = Number(digits);
  if (/k\s*$/i.test(input.trim())) n *= 1000;
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
