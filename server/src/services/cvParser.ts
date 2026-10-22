import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { aiJson } from './ai/index.js';
import { parseCvPrompt } from './ai/prompts.js';
import { parsedCvSchema, type Education, type Experience, type ParsedCv } from '../types/domain.js';

export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Checks the file's first bytes, not just its declared type. */
export function detectCvType(buf: Buffer): 'pdf' | 'docx' | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  // DOCX is a zip archive (PK\x03\x04) containing word/ parts.
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return buf.includes(Buffer.from('word/')) ? 'docx' : null;
  }
  return null;
}

export async function extractText(buf: Buffer, kind: 'pdf' | 'docx'): Promise<string> {
  const text = kind === 'pdf' ? (await pdfParse(buf)).text : (await mammoth.extractRawText({ buffer: buf })).value;
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function parseCv(rawText: string): Promise<ParsedCv> {
  const fromAi = await aiJson(parsedCvSchema, parseCvPrompt(rawText), 'parse_cv');
  return fromAi ?? ruleBasedParse(rawText);
}

// ---------------------------------------------------------------------------
// Rule-based fallback: good enough for development without an AI key.
// ---------------------------------------------------------------------------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+44\s?\(?0?\)?\s?|\(?0)(?:\d[\s-]?){9,10}\d?/;
const YEAR = '(?:19|20)\\d{2}';
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE = `(?:${MONTH}\\s+)?${YEAR}`;
const RANGE_RE = new RegExp(`(${DATE})\\s*(?:-|–|—|to|until)\\s*(${DATE}|present|current|now|today)`, 'i');
const BULLET_RE = /^\s*(?:[•\-*–·▪●]|\d+\.)\s+/;

type Section = 'summary' | 'experience' | 'education' | 'skills' | 'other';
const HEADINGS: Array<[Section, RegExp]> = [
  ['summary', /^(profile|summary|personal statement|about me|professional summary)$/i],
  ['experience', /^(experience|work experience|employment|employment history|work history|professional experience|career history)$/i],
  ['education', /^(education|qualifications|education and qualifications|academic background)$/i],
  ['skills', /^(skills|key skills|technical skills|core skills|technologies|skills and tools)$/i],
  ['other', /^(projects|interests|hobbies|references|certifications|languages|volunteering|achievements)$/i],
];

function headingOf(line: string): Section | null {
  const clean = line.replace(/[:\s]+$/, '').trim();
  if (clean.length > 40) return null;
  for (const [section, re] of HEADINGS) if (re.test(clean)) return section;
  return null;
}

function normaliseEnd(end: string): string {
  return /present|current|now|today/i.test(end) ? 'Present' : end;
}

function splitTitleCompany(line: string): { title: string; company: string } {
  const at = /^(.+?)\s+at\s+(.+)$/i.exec(line);
  if (at) return { title: at[1].trim(), company: at[2].trim() };
  const parts = line.split(/\s*(?:,|\||–|—|\s-\s)\s*/).filter(Boolean);
  if (parts.length >= 2) return { title: parts[0], company: parts.slice(1).join(', ') };
  return { title: line, company: '' };
}

function parseExperience(lines: string[]): Experience[] {
  const out: Experience[] = [];
  let cur: Experience | null = null;
  let pendingHeader: string | null = null;
  for (const line of lines) {
    const range = RANGE_RE.exec(line);
    if (range) {
      const header = line.replace(RANGE_RE, '').replace(/[()|,·\s–—-]+$/, '').replace(/^[()|,·\s–—-]+/, '').trim();
      const { title, company } = splitTitleCompany(header || pendingHeader || '');
      cur = { title, company, start: range[1], end: normaliseEnd(range[2]), bullets: [] };
      out.push(cur);
      pendingHeader = null;
      continue;
    }
    if (BULLET_RE.test(line)) {
      if (cur) cur.bullets.push(line.replace(BULLET_RE, '').trim());
      continue;
    }
    // A non-bullet line: either a header for the next role, or a continuation sentence.
    if (cur && cur.bullets.length && line.length > 60) {
      cur.bullets[cur.bullets.length - 1] += ` ${line}`;
    } else {
      pendingHeader = line;
    }
  }
  return out.filter((e) => e.title || e.company);
}

function parseEducation(lines: string[]): Education[] {
  const out: Education[] = [];
  for (const line of lines) {
    if (BULLET_RE.test(line) && out.length) continue;
    const range = RANGE_RE.exec(line);
    const yearOnly = new RegExp(`\\b(${YEAR})\\b`).exec(line);
    const text = line.replace(RANGE_RE, '').replace(BULLET_RE, '').replace(/[()|,·\s–—-]+$/, '').trim();
    if (!text) {
      const last = out[out.length - 1];
      if (last && range) Object.assign(last, { start: range[1], end: normaliseEnd(range[2]) });
      continue;
    }
    const [qualification, ...rest] = text.split(/\s*(?:,|\||–|—|\s-\s|\bat\b)\s*/);
    out.push({
      qualification: qualification ?? text,
      institution: rest.join(', '),
      start: range?.[1] ?? '',
      end: range ? normaliseEnd(range[2]) : (yearOnly?.[1] ?? ''),
    });
  }
  return out.slice(0, 6);
}

function parseSkills(lines: string[]): string[] {
  const items = lines
    .flatMap((l) => l.replace(BULLET_RE, '').replace(/^[A-Za-z ]{2,24}:\s*/, '').split(/\s*[,;|•·]\s*/))
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 0 && s.length <= 40);
  return [...new Set(items)].slice(0, 40);
}

function yearsFrom(experience: Experience[]): number | null {
  const now = new Date().getFullYear();
  let earliest = Infinity;
  let latest = -Infinity;
  for (const e of experience) {
    const s = Number(/\d{4}/.exec(e.start)?.[0]);
    const en = e.end === 'Present' ? now : Number(/\d{4}/.exec(e.end)?.[0]);
    if (s) earliest = Math.min(earliest, s);
    if (en) latest = Math.max(latest, en);
  }
  return Number.isFinite(earliest) && Number.isFinite(latest) ? Math.max(0, latest - earliest) : null;
}

export function ruleBasedParse(rawText: string): ParsedCv {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const email = EMAIL_RE.exec(rawText)?.[0] ?? '';
  const phone = (PHONE_RE.exec(rawText)?.[0] ?? '').trim();

  const sections: Record<Section | 'top', string[]> = { top: [], summary: [], experience: [], education: [], skills: [], other: [] };
  let current: Section | 'top' = 'top';
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      current = h;
      continue;
    }
    sections[current].push(line);
  }

  const contactish = (l: string) => EMAIL_RE.test(l) || PHONE_RE.test(l) || /linkedin|github|http/i.test(l);
  const top = sections.top.filter((l) => !contactish(l));
  const name = top.find((l) => /^[A-Za-z][A-Za-z' -]{1,60}$/.test(l) && l.split(/\s+/).length <= 5) ?? '';
  const headline = top.find((l) => l !== name && l.length <= 80 && !/[.]$/.test(l)) ?? '';
  const location =
    sections.top
      .flatMap((l) => l.split(/\s*[|·•]\s*/))
      .find((l) => !contactish(l) && l !== name && l !== headline && /^[A-Z][A-Za-z .'-]+(,\s*[A-Z][A-Za-z .'-]+)?$/.test(l)) ??
    '';
  const summary = (sections.summary.length ? sections.summary : top.filter((l) => l.length > 80)).join(' ');
  const experience = parseExperience(sections.experience);

  return parsedCvSchema.parse({
    name,
    email,
    phone,
    location,
    headline: headline || experience[0]?.title || '',
    summary,
    experience,
    education: parseEducation(sections.education),
    skills: parseSkills(sections.skills),
    yearsExperience: yearsFrom(experience),
  });
}
