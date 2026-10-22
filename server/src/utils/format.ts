export const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

export function salaryRange(min?: number | null, max?: number | null): string {
  if (min && max) return min === max ? gbp(min) : `${gbp(min)} to ${gbp(max)}`;
  if (min) return `From ${gbp(min)}`;
  if (max) return `Up to ${gbp(max)}`;
  return 'Salary not given';
}

export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function firstName(full?: string | null): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}
