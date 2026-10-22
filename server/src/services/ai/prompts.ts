import type { Job } from '@prisma/client';
import type { PreferencesData, ProfileData } from '../../types/domain.js';
import { asArray } from '../../utils/json.js';

/** Stored with every generated document so output can be traced to the prompt that made it. */
export const PROMPT_VERSION = 'ai-2026-10-2';

const NO_FABRICATION =
  'Rules you must follow: use only facts found in the CV and profile provided. Never invent employers, job titles, ' +
  'dates, qualifications, tools, numbers or achievements. If something is missing, leave it out. ' +
  'Write in plain British English. No exclamation marks, no hype, no jargon. Reply with JSON only.';

export function parseCvPrompt(rawText: string) {
  return {
    system:
      `You extract structured data from a CV. ${NO_FABRICATION}\n` +
      'Return JSON with exactly these keys: name, email, phone, location, headline, summary, ' +
      'experience (array of {title, company, start, end, bullets: string[]}), ' +
      'education (array of {qualification, institution, start, end}), skills (string[]), ' +
      'yearsExperience (number or null). Use empty strings for missing text. Copy bullets as written. ' +
      'Dates as written, for example "2022" or "Mar 2022". Use "Present" for current roles.',
    user: `CV text:\n"""\n${rawText.slice(0, 20000)}\n"""`,
    temperature: 0,
  };
}

function profileForPrompt(p: ProfileData) {
  return JSON.stringify({
    headline: p.headline,
    summary: p.summary,
    location: p.location,
    experience: p.experience,
    education: p.education,
    skills: p.skills,
  });
}

function jobForPrompt(job: Job) {
  return JSON.stringify({
    title: job.title,
    company: job.company,
    location: job.location,
    workMode: job.workMode,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    description: job.description,
    requirements: asArray<string>(job.requirementsJson),
  });
}

export function scorePrompt(profile: ProfileData, prefs: PreferencesData, job: Job) {
  return {
    system:
      `You judge how well a job matches a candidate. ${NO_FABRICATION}\n` +
      'Return JSON {score: integer 0 to 100, reasons: exactly 3 short sentences, reasonLine: one short sentence}. ' +
      'Reasons cover: skills fit, location and work style fit, salary against the minimum. ' +
      'Be honest: if the salary starts below the minimum, or the location does not fit, say so plainly. ' +
      'Each reason under 90 characters. reasonLine is the single most specific reason (a named skill, place or salary fact), ' +
      'never a summary: do not start with "Overall". Speak to the candidate as "you".',
    user: `Candidate profile: ${profileForPrompt(profile)}\nPreferences: ${JSON.stringify(prefs)}\nJob: ${jobForPrompt(job)}`,
    temperature: 0.2,
  };
}

export function tailorCvPrompt(profile: ProfileData, job: Job) {
  return {
    system:
      `You tailor a CV to a job by reordering and lightly rephrasing existing content. ${NO_FABRICATION}\n` +
      'Return JSON {summary: [{text, changed}], experience: [{index, bullets: [[{text, changed}]]}], skillsOrder: string[]}. ' +
      '"index" is the position of the role in the input experience array; keep every role. ' +
      'Each bullet must restate an existing bullet of the same role, never a new claim. ' +
      'Set changed to true only on phrases you reworded for this job. skillsOrder must only contain the input skills.',
    user: `CV: ${profileForPrompt(profile)}\nJob: ${jobForPrompt(job)}`,
    temperature: 0.2,
  };
}

export function coverLetterPrompt(profile: ProfileData, job: Job) {
  return {
    system:
      `You write a short cover letter in the first person. ${NO_FABRICATION}\n` +
      'Exactly 3 short paragraphs, under 220 words in total, UK spelling, grounded only in the CV and the job description. ' +
      'Return JSON {paragraphs: [[{text, changed}]]} with 3 paragraphs. Mark sentences written specifically for this job ' +
      'with changed true. Do not include a greeting or sign-off; they are added for you.',
    user: `CV: ${profileForPrompt(profile)}\nJob: ${jobForPrompt(job)}`,
    temperature: 0.3,
  };
}

export function motivationPrompt(profile: ProfileData, job: Job, question: string) {
  return {
    system:
      `You draft an answer to an application form question for the candidate, in the first person. ${NO_FABRICATION}\n` +
      'Two or three sentences, under 70 words. Return JSON {answer: string}.',
    user: `Question: ${question}\nCV: ${profileForPrompt(profile)}\nJob: ${jobForPrompt(job)}`,
    temperature: 0.3,
  };
}
