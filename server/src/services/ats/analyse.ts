import { ruleBasedParse } from '../cvParser.js';
import type { ProfileData } from '../../types/domain.js';
import { jobKeywords } from './keywords.js';

export type Sev = 'pass' | 'warn' | 'fail';
export type Area = 'kw' | 'sec' | 'fmt' | 'read' | 'basic';

/**
 * How a check can be fixed. `copy`: Shortlist's copy of the CV already does this right (single column, standard
 * headings, contact details in the body, one date format), so fixing means using that copy. `keywords`: add
 * missing keywords in the keyword tool. `null`: advice only.
 */
export type FixKind = 'copy' | 'keywords' | null;

export interface Check {
  id: string;
  area: Area;
  sev: Sev;
  title: string;
  detail: string;
  /** Share of the score this check is worth. */
  weight: number;
  fix: FixKind;
  fixLabel?: string;
}

export interface Keyword {
  k: string;
  job: number;
  cv: number;
}

export interface AtsInput {
  /** Plain text extracted from the CV file, as an ATS would read it. */
  text: string;
  /** What the person's copy is built from: their profile, or the uploaded CV's parse. */
  profile: ProfileData;
  job?: { title: string; company: string; text: string } | null;
}

export interface AtsState {
  fixed: string[];
  ignored: string[];
  added: string[];
}

export const AREAS: Array<[Area, string]> = [
  ['kw', 'Keywords'],
  ['sec', 'Sections'],
  ['fmt', 'Formatting'],
  ['read', 'Readability'],
  ['basic', 'Contact and basics'],
];

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
/** UK numbers (07…, 028…, +44…) and international ones starting with +. Date ranges such as 2024 - 2025 do not match. */
const PHONE = /(?<![\d/])(?:\+44\s?\(?0?\)?\s?\d{2,5}|\(?0\d{2,5}\)?)[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\d)|(?<![\d/])\+(?!44)\d{1,3}(?:[\s.-]?\d){8,12}(?!\d)/;
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

/** A short line on its own that reads like a heading. */
const headingText = (line: string) => line.trim().replace(/[:\s]+$/, '');
const isShort = (line: string) => line.trim().length > 0 && line.trim().length <= 40;

const STANDARD = {
  experience: /^(work |professional |employment |relevant )?(experience|history)$|^employment( history)?$|^work history$|^career history$/i,
  skills: /^((key|technical|core|relevant) )?skills( (and|&) (tools|technologies|expertise))?$|^(core )?competencies$|^technologies$|^technical expertise$/i,
  education: /^education( (and|&) (training|qualifications))?$|^qualifications$|^academic background$/i,
  summary: /^(professional |personal |career )?(summary|profile|statement)$|^personal statement$|^about( me)?$|^objective$/i,
};
/** Experience headings a person might use that application software often fails to recognise. */
const NONSTANDARD_EXPERIENCE = /^(my )?(journey|story)$|^career journey$|^professional journey$|^where i(['’]ve| have) worked$|^what i(['’]ve| have) done$|^my career$|^background$/i;

const ODD_CHARS = /[-�★☆●■◆▪➤✓✔☎✉\u{1F300}-\u{1FAFF}]/gu;

function dateFormats(text: string): string[] {
  const t = text.toLowerCase();
  const found: string[] = [];
  if (new RegExp(`\\b${MONTH}\\s+(19|20)\\d{2}\\b`).test(t)) found.push('Mon YYYY');
  if (/\b(0?[1-9]|1[0-2])\/(19|20)\d{2}\b/.test(t)) found.push('MM/YYYY');
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(t)) found.push('DD/MM/YYYY');
  if (/\b(19|20)\d{2}\s*(-|–|to)\s*((19|20)\d{2}|present|now|current)\b/.test(t) && !new RegExp(`${MONTH}\\s+(19|20)\\d{2}\\s*(-|–|to)`).test(t)) {
    found.push('YYYY');
  }
  return found;
}

/** Words that mean a line is a job title, not a place. */
const TITLE_WORDS = /\b(developer|engineer|manager|designer|analyst|consultant|officer|assistant|lead|director|specialist|executive|coordinator|administrator|architect|scientist|technician|intern|graduate|full[- ]stack|front[- ]?end|back[- ]?end)\b/i;

/**
 * The town or city near the top of the CV. A simple parser can mistake the job-title line for a place, so a
 * candidate that reads like a job title is rejected, and the person's own town is looked for instead.
 */
export function findLocation(text: string, parsedLocation: string, knownTown: string): string {
  const candidate = parsedLocation.trim();
  if (candidate && !TITLE_WORDS.test(candidate) && !EMAIL.test(candidate)) return candidate;
  const town = knownTown.split(',')[0]?.trim();
  if (!town) return '';
  const top = text.split(/\r?\n/).slice(0, 8).join('\n');
  const escaped = town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(top) ? town : '';
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** Every check, run on the CV text exactly as extracted. */
export function analyse(input: AtsInput): { checks: Check[]; keywords: Keyword[] } {
  const { text, profile } = input;
  const lines = text.split(/\r?\n/);
  const headings = lines.filter(isShort).map(headingText);
  const parsed = ruleBasedParse(text);
  const words = text.split(/\s+/).filter(Boolean).length;
  const checks: Check[] = [];

  // ---- Contact and basics
  const name = parsed.name.trim();
  checks.push(
    name && name.split(/\s+/).length <= 5
      ? { id: 'b_name', area: 'basic', sev: 'pass', title: 'Name found', detail: `Your name was read as "${name}".`, weight: 4, fix: null }
      : {
          id: 'b_name',
          area: 'basic',
          sev: 'fail',
          title: 'Your name could not be found at the top',
          detail: 'Application software expects your name on the first line, on its own.',
          weight: 4,
          fix: profile.fullName ? 'copy' : null,
          fixLabel: 'Put your name first',
        },
  );
  const hasEmail = EMAIL.test(text);
  const hasPhone = PHONE.test(text);
  if (hasEmail && hasPhone) {
    checks.push({ id: 'b_contact', area: 'basic', sev: 'pass', title: 'Email and phone found', detail: 'Recruiters can reach you from what the software read.', weight: 6, fix: null });
  } else {
    const missing = [!hasEmail && 'email', !hasPhone && 'phone number'].filter(Boolean) as string[];
    const canFix = (!hasEmail ? Boolean(profile.email) : true) && (!hasPhone ? Boolean(profile.phone) : true);
    checks.push({
      id: 'b_contact',
      area: 'basic',
      sev: hasEmail ? 'warn' : 'fail',
      title: `Your ${list(missing)} could not be read`,
      detail:
        'They may be in a page header, an image or a text box, which some software skips. Put them in the main text, under your name.',
      weight: 6,
      fix: canFix ? 'copy' : null,
      fixLabel: 'Add from your profile',
    });
  }
  const location = findLocation(text, parsed.location, profile.location);
  checks.push(
    location
      ? { id: 'b_location', area: 'basic', sev: 'pass', title: 'Location found', detail: `Your location was read as "${location}".`, weight: 2, fix: null }
      : {
          id: 'b_location',
          area: 'basic',
          sev: 'warn',
          title: 'No town or city found',
          detail: 'Many UK employers filter by location. Add your town or city near your name.',
          weight: 2,
          fix: profile.location ? 'copy' : null,
          fixLabel: 'Add from your profile',
        },
  );
  const formats = dateFormats(text);
  checks.push(
    formats.length === 0
      ? {
          id: 'b_dates',
          area: 'basic',
          sev: 'warn',
          title: 'No dates found for your roles',
          detail: 'Software works out your experience from dates. Add a start and end date to each role.',
          weight: 3,
          fix: null,
        }
      : formats.length === 1
        ? { id: 'b_dates', area: 'basic', sev: 'pass', title: 'Dates in one consistent format', detail: `Your dates use ${formats[0]}, which software reads reliably.`, weight: 3, fix: null }
        : {
            id: 'b_dates',
            area: 'basic',
            sev: 'warn',
            title: `Dates use ${formats.length} different formats`,
            detail: `We found ${list(formats)}. Mixed formats can make software miscount your experience.`,
            weight: 3,
            fix: 'copy',
            fixLabel: 'Use one date format',
          },
  );

  // ---- Sections
  const has = (re: RegExp) => headings.some((h) => re.test(h));
  const oddExperience = headings.find((h) => NONSTANDARD_EXPERIENCE.test(h));
  if (has(STANDARD.experience)) {
    checks.push({ id: 's_exp', area: 'sec', sev: 'pass', title: 'Experience section found', detail: 'Your work history is under a heading software recognises.', weight: 8, fix: null });
  } else if (oddExperience) {
    checks.push({
      id: 's_exp',
      area: 'sec',
      sev: 'warn',
      title: `Heading "${oddExperience}" may not be recognised`,
      detail: 'Most software looks for standard headings. Renaming it to "Experience" makes sure your jobs are read as work history.',
      weight: 8,
      fix: 'copy',
      fixLabel: 'Rename to Experience',
    });
  } else {
    checks.push({
      id: 's_exp',
      area: 'sec',
      sev: 'fail',
      title: 'No Experience heading found',
      detail: 'Without a standard "Experience" heading, software may not read your jobs as work history.',
      weight: 8,
      fix: profile.experience.length ? 'copy' : null,
      fixLabel: 'Add an Experience heading',
    });
  }
  const sectionCheck = (id: string, re: RegExp, label: string, weight: number, canFix: boolean, why: string): Check =>
    has(re)
      ? { id, area: 'sec', sev: 'pass', title: `${label} section found`, detail: `Your ${label.toLowerCase()} are under a standard heading.`, weight, fix: null }
      : { id, area: 'sec', sev: 'warn', title: `No ${label} heading found`, detail: why, weight, fix: canFix ? 'copy' : null, fixLabel: `Add a ${label} section` };
  checks.push(
    sectionCheck('s_skills', STANDARD.skills, 'Skills', 4, profile.skills.length > 0, 'A Skills section is where software looks first for keywords.'),
    sectionCheck('s_edu', STANDARD.education, 'Education', 3, profile.education.length > 0, 'Some roles filter on qualifications. Put yours under "Education".'),
  );
  const summaryCheck = sectionCheck(
    's_summary',
    STANDARD.summary,
    'Summary',
    3,
    Boolean(profile.summary),
    'A short summary at the top helps recruiters, and gives keywords a natural place.',
  );
  if (summaryCheck.sev === 'pass') summaryCheck.detail = 'A summary at the top introduces you and holds key terms.';
  checks.push(summaryCheck);

  // ---- Formatting
  checks.push(
    words >= 150
      ? { id: 'f_text', area: 'fmt', sev: 'pass', title: 'Text can be read', detail: 'Your file contains real text, not a picture of text.', weight: 10, fix: null }
      : {
          id: 'f_text',
          area: 'fmt',
          sev: 'fail',
          title: 'Very little text could be read',
          detail: `Only ${words} words came out. Parts of your CV may be images or text boxes, which software cannot read.`,
          weight: 10,
          fix: 'copy',
          fixLabel: 'Use a text-only copy',
        },
  );
  const odd = text.match(ODD_CHARS)?.length ?? 0;
  checks.push(
    odd < 3
      ? { id: 'f_chars', area: 'fmt', sev: 'pass', title: 'No unusual characters', detail: 'No icons or symbols that software might misread.', weight: 4, fix: null }
      : {
          id: 'f_chars',
          area: 'fmt',
          sev: 'warn',
          title: `${odd} icons or unusual characters`,
          detail: 'Icons and decorative symbols often come out as gibberish. Use plain words such as "Email:" instead.',
          weight: 4,
          fix: 'copy',
          fixLabel: 'Use plain text',
        },
  );
  const textLines = lines.filter((l) => l.trim());
  const gapped = textLines.filter((l) => /\S(\t+| {3,})\S/.test(l)).length;
  checks.push(
    // Four or more lines with wide gaps between words: text laid out side by side.
    gapped >= 4
      ? {
          id: 'f_columns',
          area: 'fmt',
          sev: 'fail',
          title: 'Parts look like columns or a table',
          detail: 'Software reads across the page, so text in columns or tables often comes out jumbled.',
          weight: 6,
          fix: 'copy',
          fixLabel: 'Convert to a single column',
        }
      : { id: 'f_columns', area: 'fmt', sev: 'pass', title: 'Single-column layout', detail: 'Your text reads in a sensible order.', weight: 6, fix: null },
  );

  // ---- Readability
  const pages = Math.max(1, Math.round((words / 450) * 2) / 2);
  checks.push(
    words < 200
      ? { id: 'r_length', area: 'read', sev: 'warn', title: 'Your CV is short', detail: 'Under a page gives software little to match. Add detail to your recent roles.', weight: 3, fix: null }
      : words > 1150
        ? {
            id: 'r_length',
            area: 'read',
            sev: 'warn',
            title: `Length is about ${pages} pages`,
            detail: 'Two A4 pages is usual for a UK CV. Trim older roles to the essentials.',
            weight: 3,
            fix: null,
          }
        : {
            id: 'r_length',
            area: 'read',
            sev: 'pass',
            title: `Length is about ${pages} ${plural(pages, 'page', 'pages')}`,
            detail: 'One to two A4 pages is right for a UK CV.',
            weight: 3,
            fix: null,
          },
  );
  const bullets = profile.experience.flatMap((e) => e.bullets).filter((b) => b.trim());
  const noResult = bullets.filter((b) => !/\d|%|£/.test(b)).length;
  checks.push(
    bullets.length && noResult >= 3
      ? {
          id: 'r_results',
          area: 'read',
          sev: 'warn',
          title: `${noResult} bullet points have no result or number`,
          detail: 'Bullets with results get more attention. Add numbers only where you can stand behind them: users, time saved, size of team.',
          weight: 3,
          fix: null,
        }
      : { id: 'r_results', area: 'read', sev: 'pass', title: 'Bullet points show results', detail: 'Most of your bullet points include a result or a number.', weight: 3, fix: null },
  );
  const longBullets = bullets.filter((b) => b.split(/\s+/).length > 35).length;
  checks.push(
    longBullets
      ? {
          id: 'r_long',
          area: 'read',
          sev: 'warn',
          title: `${longBullets} ${plural(longBullets, 'bullet point is', 'bullet points are')} very long`,
          detail: 'Keep each bullet to one or two lines so the key point stands out.',
          weight: 2,
          fix: null,
        }
      : { id: 'r_long', area: 'read', sev: 'pass', title: 'Bullet points are easy to scan', detail: 'Each bullet is one or two lines.', weight: 2, fix: null },
  );

  // ---- Keywords (only with a job)
  let keywords: Keyword[] = [];
  if (input.job?.text) {
    keywords = jobKeywords(`${input.job.title}\n${input.job.text}`, text, profile.skills);
    const missing = keywords.filter((w) => w.cv === 0);
    checks.push(
      missing.length === 0
        ? {
            id: 'k_missing',
            area: 'kw',
            sev: 'pass',
            title: keywords.length ? `All ${keywords.length} job keywords are in your CV` : 'No specific keywords found in the job',
            detail: 'Your CV uses the terms the job asks for.',
            weight: 12,
            fix: null,
          }
        : {
            id: 'k_missing',
            area: 'kw',
            sev: missing.length >= 3 ? 'fail' : 'warn',
            title: `${missing.length} ${plural(missing.length, 'keyword is', 'keywords are')} missing`,
            detail: `${list(missing.slice(0, 6).map((w) => w.k))}${missing.length > 6 ? ' and more' : ''} ${plural(missing.length, 'appears', 'appear')} in the job but not in your CV. Use the keyword tool to add the ones you really have.`,
            weight: 12,
            fix: 'keywords',
          },
    );
    const low = keywords.filter((w) => w.cv === 1 && w.job >= 3);
    checks.push(
      low.length
        ? {
            id: 'k_low',
            area: 'kw',
            sev: 'warn',
            title:
              low.length === 1
                ? `${low[0].k} appears once, the job mentions it ${low[0].job} times`
                : `${low.length} key skills appear only once`,
            detail: `Mention ${list(low.map((w) => w.k))} in the bullet points where you used ${plural(low.length, 'it', 'them')}, not just in your skills list.`,
            weight: 4,
            fix: null,
          }
        : { id: 'k_low', area: 'kw', sev: 'pass', title: 'Key skills appear in context', detail: 'The skills the job stresses most also appear in your experience.', weight: 4, fix: null },
    );
  }
  return { checks, keywords };
}

// ---------------------------------------------------------------------------
// Score and view
// ---------------------------------------------------------------------------

const isFixed = (c: Check, s: AtsState) => c.fix === 'copy' && s.fixed.includes(c.id);

/** The share of each check that counts as passed: 1 or 0, or partial for missing keywords being added. */
function earned(c: Check, s: AtsState, keywords: Keyword[]): number {
  if (c.sev === 'pass' || isFixed(c, s)) return 1;
  if (c.id === 'k_missing') {
    const present = keywords.filter((w) => w.cv > 0 || s.added.includes(w.k)).length;
    return keywords.length ? present / keywords.length : 1;
  }
  return 0;
}

export function score(checks: Check[], s: AtsState, keywords: Keyword[], area?: Area): number {
  const set = area ? checks.filter((c) => c.area === area) : checks;
  const total = set.reduce((a, c) => a + c.weight, 0);
  if (!total) return 100;
  return Math.round((100 * set.reduce((a, c) => a + c.weight * earned(c, s, keywords), 0)) / total);
}

/** Resolved: passed, fixed in the copy, ignored, or (missing keywords) every one added. */
export function resolved(c: Check, s: AtsState, keywords: Keyword[]): boolean {
  return c.sev === 'pass' || isFixed(c, s) || s.ignored.includes(c.id) || (c.id === 'k_missing' && earned(c, s, keywords) === 1);
}

/** The score if every fixable issue were fixed and every missing keyword added. */
export function potential(checks: Check[], s: AtsState, keywords: Keyword[]): number {
  const all: AtsState = {
    fixed: checks.filter((c) => c.fix === 'copy').map((c) => c.id),
    ignored: s.ignored,
    added: keywords.filter((w) => w.cv === 0).map((w) => w.k),
  };
  return score(checks, all, keywords);
}

export function verdict(n: number): string {
  if (n >= 90) return 'Strong. Ready to send.';
  if (n >= 75) return 'Good. A few quick fixes left.';
  return 'Needs work before you apply.';
}

/** "How the ATS reads you": what a simple parser pulls out, and what the fixed copy changes. */
export function fields(text: string, profile: ProfileData, s: AtsState) {
  const p = ruleBasedParse(text);
  const fixed = (id: string) => s.fixed.includes(id);
  const email = text.match(EMAIL)?.[0];
  const phone = text.match(PHONE)?.[0];
  const row = (label: string, value: string | null | undefined, fixedValue?: string | null, fixedBy?: string) => {
    if (value) return { label, value, ok: true };
    if (fixedBy && fixed(fixedBy) && fixedValue) return { label, value: fixedValue, ok: true, fixed: true };
    return { label, value: 'Not found', ok: false };
  };
  const latest = p.experience[0];
  const eduFirst = p.education[0];
  return [
    row('Name', p.name, profile.fullName, 'b_name'),
    row('Email', email, profile.email, 'b_contact'),
    row('Phone', phone, profile.phone, 'b_contact'),
    row('Location', findLocation(text, p.location, profile.location), profile.location, 'b_location'),
    row('Latest job', latest ? [latest.title, latest.company].filter(Boolean).join(', ') : '', profile.experience[0]?.title, 's_exp'),
    row(
      'Work history',
      p.experience.length ? `${p.experience.length} ${plural(p.experience.length, 'role', 'roles')} found` : '',
      profile.experience.length ? `${profile.experience.length} ${plural(profile.experience.length, 'role', 'roles')} found` : '',
      's_exp',
    ),
    row(
      'Skills',
      p.skills.length ? `${p.skills.length} skills read` : '',
      profile.skills.length ? `${profile.skills.length + s.added.length} skills read` : '',
      's_skills',
    ),
    row(
      'Education',
      eduFirst ? [eduFirst.qualification, eduFirst.institution].filter(Boolean).join(', ') : '',
      profile.education[0] ? [profile.education[0].qualification, profile.education[0].institution].filter(Boolean).join(', ') : '',
      's_edu',
    ),
  ];
}

export interface TextLine {
  text: string;
  /** bad: where software goes wrong. good: what the fixed copy changes. */
  mark?: 'bad' | 'good';
}

/** The plain text the software reads, with problems marked, and fixed lines shown as they read in the copy. */
export function textView(text: string, profile: ProfileData, s: AtsState, maxLines = 60): TextLine[] {
  const out: TextLine[] = [];
  const raw = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l, i, a) => l.trim() || (a[i - 1] ?? '').trim());
  const hasContact = EMAIL.test(text) && PHONE.test(text);
  raw.slice(0, maxLines).forEach((line, i) => {
    const h = headingText(line);
    if (isShort(line) && NONSTANDARD_EXPERIENCE.test(h)) {
      out.push(s.fixed.includes('s_exp') ? { text: 'EXPERIENCE', mark: 'good' } : { text: line, mark: 'bad' });
    } else if (ODD_CHARS.test(line)) {
      ODD_CHARS.lastIndex = 0;
      out.push(s.fixed.includes('f_chars') ? { text: line.replace(ODD_CHARS, '').trim(), mark: 'good' } : { text: line, mark: 'bad' });
    } else if (/\S(\t+| {3,})\S/.test(line)) {
      out.push(s.fixed.includes('f_columns') ? { text: line.replace(/(\t+| {3,})/g, ' · ').trim(), mark: 'good' } : { text: line, mark: 'bad' });
    } else {
      out.push({ text: line });
    }
    ODD_CHARS.lastIndex = 0;
    if (i === 0 && !hasContact) {
      const contact = [profile.email, profile.phone].filter(Boolean).join(' · ');
      out.push(
        s.fixed.includes('b_contact') && contact
          ? { text: contact, mark: 'good' }
          : { text: '[email and phone not found]', mark: 'bad' },
      );
    }
  });
  if (raw.length > maxLines) out.push({ text: '…' });
  return out;
}
