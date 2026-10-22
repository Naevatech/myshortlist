import type { Job } from '@prisma/client';
import { z } from 'zod';
import { aiJson } from './ai/index.js';
import { scorePrompt } from './ai/prompts.js';
import { asArray } from '../utils/json.js';
import { gbp, listJoin } from '../utils/format.js';
import type { MatchResult, PreferencesData, ProfileData } from '../types/domain.js';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 1 && !['and', 'the', 'for', 'with'].includes(w));

export function jobText(job: Job): string {
  return [job.title, job.description, ...asArray<string>(job.requirementsJson)].join(' \n ');
}

/** Profile skills that the job's text mentions, in the order the CV lists them. */
export function matchedSkills(skills: string[], job: Job): string[] {
  const text = jobText(job);
  return skills.filter((s) => s.trim() && new RegExp(`(^|[^A-Za-z0-9])${escapeRe(s.trim())}(?![A-Za-z0-9])`, 'i').test(text));
}

function titleSimilarity(roles: string[], title: string): number {
  const t = new Set(tokens(title));
  let best = 0;
  for (const r of roles) {
    const rt = tokens(r);
    if (!rt.length) continue;
    const overlap = rt.filter((w) => t.has(w)).length;
    best = Math.max(best, overlap / Math.max(rt.length, t.size));
  }
  return best;
}

const modeWord = (m: Job['workMode']) => (m === 'onsite' ? 'on-site' : m);

function locationFit(prefs: PreferencesData, job: Job): { value: number; reason: string } {
  const styleOk = prefs.workStyles.length === 0 || prefs.workStyles.includes(job.workMode);
  if (job.workMode === 'remote') {
    return styleOk
      ? { value: 1, reason: 'The role is remote, which fits your work style.' }
      : { value: 0.6, reason: 'The role is fully remote, which is not one of the work styles you chose.' };
  }
  const want = prefs.location.trim().toLowerCase();
  const loc = job.location.toLowerCase();
  const sameTown = !want || loc.includes(want) || want.includes(loc);
  const where = `${modeWord(job.workMode)} in ${job.location}`;
  if (sameTown && styleOk) return { value: 1, reason: `The role is ${where}, which fits your location and work style.` };
  if (sameTown) return { value: 0.5, reason: `The role is ${where}. That is not one of the work styles you chose.` };
  if (styleOk) return { value: 0.6, reason: `The role is ${where}. Check the commute from ${prefs.location}.` };
  return { value: 0.3, reason: `The role is ${where}, outside your chosen location and work style.` };
}

function salaryFit(prefs: PreferencesData, job: Job): { value: number; reason: string; below: boolean } {
  const min = prefs.minSalary;
  if (!job.salaryMin && !job.salaryMax) return { value: 0.6, reason: 'The salary is not listed.', below: false };
  if (!min) return { value: 0.8, reason: 'You have not set a minimum salary.', below: false };
  if ((job.salaryMin ?? job.salaryMax!) >= min) {
    return { value: 1, reason: `The salary range is above your minimum of ${gbp(min)}.`, below: false };
  }
  if ((job.salaryMax ?? 0) >= min) {
    return { value: 0.6, reason: 'The salary range starts below your minimum.', below: true };
  }
  return { value: 0.2, reason: `The salary range is below your minimum of ${gbp(min)}.`, below: true };
}

/** Deterministic score and template reasons, used when no AI key is set. */
export function scoreDeterministic(profile: ProfileData, prefs: PreferencesData, job: Job): MatchResult {
  const roles = prefs.roles.length ? prefs.roles : profile.experience.slice(0, 1).map((e) => e.title);
  const title = titleSimilarity(roles, job.title);
  const skills = matchedSkills(profile.skills, job);
  const skillValue = Math.min(1, skills.length / 3);
  const loc = locationFit(prefs, job);
  const sal = salaryFit(prefs, job);

  // Weighted fit from 0 to 1, shown on a 30 to 96 scale: a rule-based score should not claim a perfect match.
  const fit = 0.35 * title + 0.3 * skillValue + 0.2 * loc.value + 0.15 * sal.value;
  const score = Math.round(30 + 66 * fit);

  const top = skills.slice(0, 2);
  const skillsReason =
    top.length === 2
      ? `Your ${listJoin(top)} experience matches the main requirements.`
      : top.length === 1
        ? `Your ${top[0]} experience matches one of the main requirements.`
        : 'Few of the skills in your CV are named in this listing.';

  let reasonLine: string;
  if (sal.below) reasonLine = `${skills.length >= 2 ? 'Strong stack match.' : 'A partial stack match.'} ${sal.reason}`;
  else if (top.length === 2) reasonLine = `Your ${listJoin(top)} experience matches the core stack.`;
  else if (top.length === 1) reasonLine = `Your ${top[0]} experience matches part of this role.`;
  else reasonLine = loc.reason;

  return { score: Math.max(0, Math.min(100, score)), reasons: [skillsReason, loc.reason, sal.reason], reasonLine };
}

const aiScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  reasons: z.tuple([z.string().min(3), z.string().min(3), z.string().min(3)]),
  reasonLine: z.string().min(3).max(200),
});

export async function scoreMatch(profile: ProfileData, prefs: PreferencesData, job: Job): Promise<MatchResult> {
  const res = await aiJson(aiScoreSchema, scorePrompt(profile, prefs, job), 'score_match');
  return res ?? scoreDeterministic(profile, prefs, job);
}
