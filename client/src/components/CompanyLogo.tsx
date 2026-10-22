import { useState } from 'react';

const STOP = new Set(['ltd', 'limited', 'plc', 'llp', 'inc', 'group', 'the', 'and', '&', 'uk']);

/** "Halden & Moore" → "HM", "Ocho" → "O", "MCS Group" → "MC". */
export function initials(company: string): string {
  const words = company
    .replace(/[^\p{L}\p{N}&\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  if (!words.length) return company.trim().charAt(0).toUpperCase() || '?';
  if (words.length === 1) {
    const w = words[0];
    // Acronyms keep two letters ("MCS" → "MC"); ordinary words keep one.
    return (w === w.toUpperCase() && w.length > 1 ? w.slice(0, 2) : w.charAt(0)).toUpperCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/** Logo.dev publishable key (safe in the browser). Without it, initials are shown. */
const LOGO_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined;
export const logosEnabled = Boolean(LOGO_TOKEN);

/** Looks a company up by name. fallback=404 lets us show initials when there is no logo. */
export function logoUrlFor(company: string, px: number): string | null {
  if (!LOGO_TOKEN || !company.trim() || company === 'Company not named') return null;
  const name = encodeURIComponent(company.replace(/\b(ltd|limited|plc|llp)\b\.?/gi, '').trim());
  return `https://img.logo.dev/name/${name}?token=${encodeURIComponent(LOGO_TOKEN)}&size=${px}&format=png&retina=true&fallback=404`;
}

interface Props {
  company: string;
  /** A logo provided by the job source wins over the name lookup. */
  src?: string | null;
  size?: 'md' | 'lg';
}

/**
 * Company mark beside a job: the company's logo when one can be found, otherwise its initials in a quiet tile.
 * Decorative: the company name is always shown next to it.
 */
export function CompanyLogo({ company, src, size = 'md' }: Props) {
  const [failed, setFailed] = useState(false);
  const url = src || logoUrlFor(company, size === 'lg' ? 56 : 44);
  const cls = size === 'lg' ? 'logo lg' : 'logo';
  return (
    <span className={cls} aria-hidden="true">
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        initials(company)
      )}
    </span>
  );
}
