import type { Job } from '@prisma/client';
import { z } from 'zod';
import { aiJson } from './ai/index.js';
import { coverLetterPrompt, motivationPrompt, PROMPT_VERSION, tailorCvPrompt } from './ai/prompts.js';
import { matchedSkills, jobText } from './matching.js';
import { defaultFormSchema } from './jobs/placeholder.js';
import { asArray } from '../utils/json.js';
import { gbp, listJoin } from '../utils/format.js';
import {
  segmentSchema,
  type Block,
  type FormQuestion,
  type PreferencesData,
  type ProfileData,
  type Segment,
} from '../types/domain.js';

export const TEMPLATE_VERSION = 'template-1';

const seg = (text: string, changed = false): Segment => ({ text, changed });
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const dates = (start: string, end: string) => [start, end].filter(Boolean).join(' to ');

function relevance(text: string, job: Job): number {
  const jt = jobText(job).toLowerCase();
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 3 && jt.includes(w)).length;
}

function cvHeader(p: ProfileData): Block[] {
  const meta = [p.headline, p.location, p.email].filter(Boolean).join(' · ');
  return [
    { type: 'heading', segments: [seg(p.fullName || 'Your name')] },
    ...(meta ? [{ type: 'meta' as const, segments: [seg(meta)] }] : []),
  ];
}

function cvTail(p: ProfileData, skillsOrder: string[]): Block[] {
  const blocks: Block[] = [];
  if (p.education.length) {
    blocks.push({ type: 'section', segments: [seg('Education')] });
    for (const e of p.education) {
      blocks.push({
        type: 'entry',
        segments: [seg([e.qualification, e.institution].filter(Boolean).join(', '))],
        aside: dates(e.start, e.end) || undefined,
      });
    }
  }
  if (skillsOrder.length) {
    blocks.push({ type: 'section', segments: [seg('Skills')] });
    blocks.push({ type: 'paragraph', segments: [seg(skillsOrder.join(', '))] });
  }
  return blocks;
}

/** Template CV: the user's own content, reordered for the job. Only the added summary sentence is new wording. */
export function templateCv(p: ProfileData, job: Job): Block[] {
  const matched = matchedSkills(p.skills, job);
  const blocks = cvHeader(p);
  const summary: Segment[] = [];
  if (p.summary) summary.push(seg(sentence(p.summary)));
  if (matched.length) {
    summary.push(seg(`${summary.length ? ' ' : ''}Experienced with ${listJoin(matched.slice(0, 3))}, which this role asks for.`, true));
  }
  if (summary.length) blocks.push({ type: 'section', segments: [seg('Summary')] }, { type: 'paragraph', segments: summary });

  if (p.experience.length) {
    blocks.push({ type: 'section', segments: [seg('Experience')] });
    for (const e of p.experience) {
      blocks.push({
        type: 'entry',
        segments: [seg([e.title, e.company].filter(Boolean).join(', '))],
        aside: dates(e.start, e.end) || undefined,
      });
      const bullets = [...e.bullets].sort((a, b) => relevance(b, job) - relevance(a, job));
      if (bullets.length) blocks.push({ type: 'bullets', items: bullets.map((b) => [seg(b)]) });
    }
  }
  const skillsOrder = [...matched, ...p.skills.filter((s) => !matched.includes(s))];
  return [...blocks, ...cvTail(p, skillsOrder)];
}

const aiCvSchema = z.object({
  summary: z.array(segmentSchema).min(1),
  experience: z.array(z.object({ index: z.number().int().min(0), bullets: z.array(z.array(segmentSchema)) })),
  skillsOrder: z.array(z.string()),
});

async function aiCv(p: ProfileData, job: Job): Promise<Block[] | null> {
  const res = await aiJson(aiCvSchema, tailorCvPrompt(p, job), 'tailor_cv');
  if (!res) return null;
  const blocks = cvHeader(p);
  blocks.push({ type: 'section', segments: [seg('Summary')] }, { type: 'paragraph', segments: res.summary });
  if (p.experience.length) blocks.push({ type: 'section', segments: [seg('Experience')] });
  p.experience.forEach((e, i) => {
    blocks.push({
      type: 'entry',
      segments: [seg([e.title, e.company].filter(Boolean).join(', '))],
      aside: dates(e.start, e.end) || undefined,
    });
    let fromAi = res.experience.find((x) => x.index === i)?.bullets;
    // Models sometimes return a role's bullets as pieces of one bullet. Each piece is then its own bullet.
    if (fromAi && fromAi.length < e.bullets.length && fromAi.flat().length === e.bullets.length) {
      fromAi = fromAi.flat().map((s) => [{ ...s, text: s.text.trim() }]);
    }
    // Guard against invented claims: never more bullets than the CV has for this role.
    const items = fromAi && fromAi.length && fromAi.length <= e.bullets.length ? fromAi : e.bullets.map((b) => [seg(b)]);
    if (items.length) blocks.push({ type: 'bullets', items });
  });
  const known = new Set(p.skills);
  const order = [...new Set(res.skillsOrder.filter((s) => known.has(s)))];
  return [...blocks, ...cvTail(p, [...order, ...p.skills.filter((s) => !order.includes(s))])];
}

function signOff(p: ProfileData): Block {
  return { type: 'paragraph', segments: [seg(`Kind regards,\n${p.fullName || 'Your name'}`)] };
}

/** Template cover letter: job title, company and two facts from the CV. */
export function templateCoverLetter(p: ProfileData, job: Job): Block[] {
  const matched = matchedSkills(p.skills, job).slice(0, 2);
  const latest = p.experience[0];
  const p1: Segment[] = [seg(`I am applying for the ${job.title} role at ${job.company}. `)];
  p1.push(
    matched.length
      ? seg(`Your job description asks for ${listJoin(matched)}, which is the work I have been doing.`, true)
      : seg(`The role builds on the work I have been doing${latest?.title ? ` as a ${latest.title}` : ''}.`, true),
  );

  const p2: Segment[] = [];
  if (latest) {
    p2.push(seg(`At ${latest.company || 'my most recent role'} I worked as a ${latest.title || 'developer'}. `));
    const bullet = [...latest.bullets].sort((a, b) => relevance(b, job) - relevance(a, job))[0];
    if (bullet) p2.push(seg(`In that role I ${lowerFirst(sentence(bullet))} `));
    p2.push(seg(`This experience fits what you describe for the ${job.title} role.`, true));
  } else {
    p2.push(seg(`My CV sets out my experience, and I would be glad to talk it through.`));
  }

  return [
    { type: 'paragraph', segments: [seg('Dear Hiring Team,')] },
    { type: 'paragraph', segments: p1 },
    { type: 'paragraph', segments: p2 },
    {
      type: 'paragraph',
      segments: [seg('I would welcome the chance to talk about how I can help your team. Thank you for your time.')],
    },
    signOff(p),
  ];
}

const aiLetterSchema = z.object({ paragraphs: z.array(z.array(segmentSchema).min(1)).length(3) });

async function aiCoverLetter(p: ProfileData, job: Job): Promise<Block[] | null> {
  const res = await aiJson(aiLetterSchema, coverLetterPrompt(p, job), 'cover_letter');
  if (!res) return null;
  const words = res.paragraphs.flat().map((s) => s.text).join(' ').split(/\s+/).length;
  if (words > 240) return null;
  return [
    { type: 'paragraph', segments: [seg('Dear Hiring Team,')] },
    ...res.paragraphs.map((segments) => ({ type: 'paragraph' as const, segments })),
    signOff(p),
  ];
}

export async function tailorDocuments(p: ProfileData, job: Job) {
  const [cvAi, letterAi] = await Promise.all([aiCv(p, job), aiCoverLetter(p, job)]);
  return {
    cv: { blocks: cvAi ?? templateCv(p, job), promptVersion: cvAi ? PROMPT_VERSION : TEMPLATE_VERSION },
    coverLetter: {
      blocks: letterAi ?? templateCoverLetter(p, job),
      promptVersion: letterAi ? PROMPT_VERSION : TEMPLATE_VERSION,
    },
  };
}

// ---------------------------------------------------------------------------
// Form answers
// ---------------------------------------------------------------------------

export interface DraftAnswer {
  key: string;
  label: string;
  value: string;
  source: 'cv' | 'profile' | 'ai' | 'user';
  needsAttention: boolean;
  multiline: boolean;
}

export function formQuestions(job: Job): FormQuestion[] {
  const fromJob = asArray<FormQuestion>(job.formSchemaJson);
  return fromJob.length ? fromJob : defaultFormSchema(job.company);
}

function templateMotivation(p: ProfileData, job: Job): string {
  const matched = matchedSkills(p.skills, job).slice(0, 2);
  return (
    `The ${job.title} role at ${job.company} matches the work I do best. ` +
    (matched.length
      ? `My experience with ${listJoin(matched)} fits the skills your job description asks for, and I would like to bring it to your team.`
      : 'I would like to bring my experience to your team.')
  );
}

export async function draftAnswers(p: ProfileData, prefs: PreferencesData, job: Job): Promise<DraftAnswer[]> {
  const out: DraftAnswer[] = [];
  for (const q of formQuestions(job)) {
    let value = '';
    let source: DraftAnswer['source'] = 'cv';
    switch (q.kind) {
      case 'name':
        value = p.fullName;
        break;
      case 'email':
        value = p.email;
        break;
      case 'phone':
        value = p.phone ?? '';
        break;
      case 'right_to_work':
        value = prefs.rightToWorkUk ? 'Yes' : 'No';
        source = 'profile';
        break;
      case 'salary': {
        const v = Math.max(prefs.minSalary ?? 0, job.salaryMin ?? 0);
        value = v ? gbp(v) : '';
        source = 'ai';
        break;
      }
      case 'motivation': {
        const res = await aiJson(z.object({ answer: z.string().min(10).max(800) }), motivationPrompt(p, job, q.label), 'motivation');
        value = res?.answer ?? templateMotivation(p, job);
        source = 'ai';
        break;
      }
      default:
        // Notice period and unknown questions cannot be answered from the CV.
        value = '';
        source = 'profile';
    }
    out.push({ key: q.key, label: q.label, value, source, needsAttention: !value.trim(), multiline: Boolean(q.multiline) });
  }
  return out;
}

/** The grey helper line shown under each answer. */
export function answerHint(a: { key: string; source: string; needsAttention: boolean }): string {
  if (a.needsAttention) return 'Needs your answer. We could not find this in your CV.';
  if (a.source === 'user') return 'Your answer.';
  if (a.key === 'salary_expectation') return "Drafted from your minimum salary and this role's range. Please check.";
  if (a.source === 'ai') return 'Drafted from the job description and your CV. Please check.';
  if (a.source === 'profile') return 'From your profile.';
  return 'From your CV.';
}
