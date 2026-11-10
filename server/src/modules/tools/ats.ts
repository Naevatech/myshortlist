import { Router, type Request } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AtsCheck, Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { asArray, asObject, toJson } from '../../utils/json.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { DOCX_MIME, PDF_MIME, detectCvType, extractText, parseCv } from '../../services/cvParser.js';
import { loadCandidate } from '../../services/profileData.js';
import { plainCv } from '../../services/tailoring.js';
import { renderPdf } from '../../services/pdf.js';
import { jobText } from '../../services/matching.js';
import { formatUkDate, ukToday } from '../../utils/dates.js';
import type { Block, ProfileData } from '../../types/domain.js';
import {
  AREAS,
  analyse,
  fields,
  potential,
  resolved,
  score,
  textView,
  verdict,
  type AtsState,
} from '../../services/ats/analyse.js';

export const atsRouter = Router();
atsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_CV_SIZE_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 60_000 },
});

/** New checks: 30 an hour per person. Fixing and re-opening are not limited. */
const checkLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: (req: Request) => `ats:${req.user?.id ?? req.ip}`,
  message: { error: { code: 'rate_limited', message: 'You have run a lot of checks. Try again in an hour.' } },
});

const READ_FAILED = 'We could not read this file. Try a PDF or Word document.';
const EMPTY_STATE: AtsState = { fixed: [], ignored: [], added: [] };
const stateOf = (c: AtsCheck): AtsState => ({ ...EMPTY_STATE, ...asObject<AtsState>(c.stateJson, EMPTY_STATE) });

const DAY_MS = 86_400_000;

/** What the set-up step offers: the current CV, and recent matches to check against. */
atsRouter.get('/setup', async (req, res) => {
  const user = currentUser(req);
  const since = new Date(ukToday().getTime() - env.JOB_RETENTION_DAYS * DAY_MS);
  const [cv, matches] = await Promise.all([
    prisma.cv.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { createdAt: 'desc' }, select: { fileName: true, updatedAt: true } }),
    prisma.match.findMany({
      where: { userId: user.id, matchedOn: { gte: since }, status: { notIn: ['skipped', 'expired'] } },
      include: { job: { select: { title: true, company: true } } },
      orderBy: [{ matchedOn: 'desc' }, { score: 'desc' }],
      take: 20,
    }),
  ]);
  const today = ukToday().getTime();
  res.json({
    cv: cv ? { fileName: cv.fileName, updatedAt: cv.updatedAt } : null,
    maxCvSizeMb: env.MAX_CV_SIZE_MB,
    jobs: matches.map((m) => ({
      matchId: m.id,
      title: m.job.title,
      company: m.job.company,
      score: m.score,
      foundDaysAgo: Math.round((today - m.matchedOn.getTime()) / DAY_MS),
    })),
  });
});

/** Everything the results screen shows, recomputed from the stored CV text so it always matches the rules. */
function view(c: AtsCheck) {
  const profile = asObject<ProfileData>(c.profileJson, {} as ProfileData);
  const s = stateOf(c);
  const job = c.jobText ? { title: c.jobTitle ?? '', company: c.company ?? '', text: c.jobText } : null;
  const { checks, keywords } = analyse({ text: c.cvText, profile, job });
  const now = score(checks, s, keywords);
  const remaining = checks.filter((k) => !resolved(k, s, keywords));
  return {
    id: c.id,
    createdAt: c.createdAt,
    cvFileName: c.cvFileName,
    job: job ? { title: job.title, company: job.company, matchId: c.matchId } : null,
    jobSource: c.jobSource,
    score: now,
    initialScore: c.initialScore,
    verdict: verdict(now),
    remaining: remaining.length,
    potential: potential(checks, s, keywords),
    areas: AREAS.filter(([a]) => a !== 'kw' || job).map(([id, label]) => {
      const left = checks.filter((k) => k.area === id && !resolved(k, s, keywords)).length;
      return { id, label, score: score(checks, s, keywords, id), left };
    }),
    checks: checks.map((k) => ({
      id: k.id,
      area: k.area,
      sev: k.sev,
      title: k.title,
      detail: k.detail,
      fix: k.fix,
      fixLabel: k.fixLabel ?? null,
      points: Math.round((100 * k.weight) / checks.reduce((a, x) => a + x.weight, 0)),
      fixed: k.fix === 'copy' && s.fixed.includes(k.id),
      ignored: s.ignored.includes(k.id),
      resolved: resolved(k, s, keywords),
    })),
    keywords: keywords.map((w) => ({ ...w, added: w.cv === 0 && s.added.includes(w.k) })),
    fields: fields(c.cvText, profile, s),
    text: textView(c.cvText, profile, s),
    /** Where the fixed copy lives: the match's tailored CV, or a copy to download. */
    copy: c.matchId ? 'match' : 'download',
  };
}

async function ownedCheck(userId: string, id: string) {
  const c = await prisma.atsCheck.findUnique({ where: { id } });
  if (!c || c.userId !== userId) throw notFound('We could not find this check.');
  return c;
}

const createSchema = z.object({
  cvSource: z.enum(['current', 'upload']),
  jobSource: z.enum(['match', 'paste', 'none']),
  matchId: z.string().max(64).optional(),
  jobText: z.string().max(50_000).optional(),
  jobTitle: z.string().max(200).optional(),
});

/** Runs a new check. The uploaded CV (if any) is read here and not stored as a file. */
atsRouter.post('/checks', checkLimiter, upload.single('file'), async (req, res) => {
  const user = currentUser(req);
  const body = createSchema.safeParse(req.body ?? {});
  if (!body.success) throw badRequest('invalid_request', 'Some of the details are not valid.');
  const { cvSource, jobSource } = body.data;

  let cvText: string;
  let cvFileName: string;
  let profile: ProfileData;
  if (cvSource === 'upload') {
    const file = req.file;
    if (!file) throw badRequest('no_file', 'Choose a CV to check.');
    if (![PDF_MIME, DOCX_MIME].includes(file.mimetype)) throw badRequest('invalid_file', READ_FAILED);
    const kind = detectCvType(file.buffer);
    if (!kind || (kind === 'pdf') !== (file.mimetype === PDF_MIME)) throw badRequest('invalid_file', READ_FAILED);
    try {
      cvText = await extractText(file.buffer, kind);
    } catch {
      throw badRequest('invalid_file', READ_FAILED);
    }
    if (cvText.replace(/\s/g, '').length < 30) throw badRequest('invalid_file', READ_FAILED);
    const parsed = await parseCv(cvText);
    cvFileName = file.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 200) || `cv.${kind}`;
    profile = {
      fullName: parsed.name,
      email: parsed.email,
      phone: parsed.phone || null,
      location: parsed.location,
      headline: parsed.headline,
      summary: parsed.summary,
      experience: parsed.experience,
      education: parsed.education,
      skills: parsed.skills,
    };
  } else {
    const cv = await prisma.cv.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { createdAt: 'desc' } });
    if (!cv) throw badRequest('no_cv', 'Upload a CV first, or choose "Upload a different CV".');
    cvText = cv.rawText;
    cvFileName = cv.fileName;
    profile = (await loadCandidate(user.id)).profile;
  }

  let matchId: string | null = null;
  let jobTitle: string | null = null;
  let company: string | null = null;
  let text: string | null = null;
  if (jobSource === 'match') {
    const m = body.data.matchId
      ? await prisma.match.findUnique({ where: { id: body.data.matchId }, include: { job: true } })
      : null;
    if (!m || m.userId !== user.id) throw notFound('We could not find this job.');
    matchId = m.id;
    jobTitle = m.job.title;
    company = m.job.company;
    text = jobText(m.job);
  } else if (jobSource === 'paste') {
    text = (body.data.jobText ?? '').trim();
    if (text.split(/\s+/).length < 30) throw badRequest('job_too_short', 'Paste the full job advert, at least a few sentences.');
    jobTitle = body.data.jobTitle?.trim() || null;
  }

  const s = EMPTY_STATE;
  const { checks, keywords } = analyse({ text: cvText, profile, job: text ? { title: jobTitle ?? '', company: company ?? '', text } : null });
  const created = await prisma.atsCheck.create({
    data: {
      userId: user.id,
      matchId,
      cvSource,
      cvFileName,
      cvText,
      profileJson: toJson(profile),
      jobSource,
      jobTitle,
      company,
      jobText: text,
      initialScore: score(checks, s, keywords),
      stateJson: toJson(s),
      copyJson: matchId ? undefined : toJson(plainCv(profile)),
    },
  });
  res.status(201).json(view(created));
});

atsRouter.get('/checks/:id', async (req, res) => {
  res.json(view(await ownedCheck(currentUser(req).id, String(req.params.id))));
});

// ---------------------------------------------------------------------------
// The fixed copy: the match's tailored CV, or the check's own copy.
// ---------------------------------------------------------------------------

/** The Skills paragraph of a CV, created if missing. */
function skillsParagraph(blocks: Block[]) {
  const i = blocks.findIndex((b) => b.type === 'section' && b.segments.map((x) => x.text).join('').trim().toLowerCase() === 'skills');
  if (i >= 0 && blocks[i + 1]?.type === 'paragraph') return blocks[i + 1] as Extract<Block, { type: 'paragraph' }>;
  const para: Block = { type: 'paragraph', segments: [] };
  blocks.push({ type: 'section', segments: [{ text: 'Skills', changed: false }] }, para);
  return para as Extract<Block, { type: 'paragraph' }>;
}

export function addSkill(blocks: Block[], skill: string): Block[] {
  const copy = structuredClone(blocks);
  const p = skillsParagraph(copy);
  const current = p.segments.map((x) => x.text).join('');
  if (new RegExp(`(^|,\\s*)${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,|$)`, 'i').test(current)) return copy;
  p.segments.push({ text: current.trim() ? `, ${skill}` : skill, changed: true });
  return copy;
}

export function removeSkill(blocks: Block[], skill: string): Block[] {
  const copy = structuredClone(blocks);
  const p = skillsParagraph(copy);
  p.segments = p.segments.filter((x) => !(x.changed && x.text.replace(/^,\s*/, '') === skill));
  return copy;
}

/** Applies a keyword change to wherever the fixed copy lives. */
async function editCopy(c: AtsCheck, change: (b: Block[]) => Block[]) {
  if (c.matchId) {
    const doc = await prisma.document.findUnique({ where: { matchId_type: { matchId: c.matchId, type: 'cv' } }, include: { match: true } });
    if (doc && doc.match.status !== 'applied') {
      await prisma.document.update({
        where: { id: doc.id },
        data: { blocksJson: toJson(change(asArray<Block>(doc.blocksJson))), version: { increment: 1 }, pdfKey: null },
      });
      return;
    }
    if (doc) throw conflict('already_applied', 'This CV was already sent with your application, so it cannot be changed.');
  }
  const blocks = c.copyJson ? asArray<Block>(c.copyJson) : plainCv(asObject<ProfileData>(c.profileJson, {} as ProfileData));
  await prisma.atsCheck.update({ where: { id: c.id }, data: { copyJson: toJson(change(blocks)) } });
}

const actionSchema = z.object({
  action: z.enum(['fix', 'undo', 'ignore', 'unignore', 'add', 'remove']),
  id: z.string().max(40).optional(),
  keyword: z.string().max(60).optional(),
});

atsRouter.post('/checks/:id/actions', validateBody(actionSchema), async (req, res) => {
  const c = await ownedCheck(currentUser(req).id, String(req.params.id));
  const s = stateOf(c);
  const { action, id, keyword } = req.body as z.infer<typeof actionSchema>;
  const profile = asObject<ProfileData>(c.profileJson, {} as ProfileData);
  const { checks, keywords } = analyse({
    text: c.cvText,
    profile,
    job: c.jobText ? { title: c.jobTitle ?? '', company: c.company ?? '', text: c.jobText } : null,
  });
  const toggle = (list: string[], value: string, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((x) => x !== value));

  if (action === 'add' || action === 'remove') {
    const w = keywords.find((x) => x.k === keyword && x.cv === 0);
    if (!w) throw badRequest('invalid_keyword', 'That keyword is not missing from your CV.');
    await editCopy(c, (b) => (action === 'add' ? addSkill(b, w.k) : removeSkill(b, w.k)));
    s.added = toggle(s.added, w.k, action === 'add');
  } else {
    const check = checks.find((x) => x.id === id);
    if (!check) throw badRequest('invalid_check', 'We could not find that check.');
    if ((action === 'fix' || action === 'undo') && check.fix !== 'copy') throw badRequest('not_fixable', 'This one needs a change you make yourself.');
    if (action === 'fix' || action === 'undo') s.fixed = toggle(s.fixed, check.id, action === 'fix');
    else s.ignored = toggle(s.ignored, check.id, action === 'ignore');
  }
  const updated = await prisma.atsCheck.update({ where: { id: c.id }, data: { stateJson: toJson(s) } });
  res.json(view(updated));
});

/** Re-runs the check on the latest CV (current CV only) and job text, keeping fixes that still apply. */
atsRouter.post('/checks/:id/rescan', async (req, res) => {
  const user = currentUser(req);
  const c = await ownedCheck(user.id, String(req.params.id));
  const data: Prisma.AtsCheckUpdateInput = {};
  if (c.cvSource === 'current') {
    const cv = await prisma.cv.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { createdAt: 'desc' } });
    if (cv) {
      data.cvText = cv.rawText;
      data.cvFileName = cv.fileName;
      data.profileJson = toJson((await loadCandidate(user.id)).profile);
    }
  }
  if (c.matchId) {
    const m = await prisma.match.findUnique({ where: { id: c.matchId }, include: { job: true } });
    if (m) data.jobText = jobText(m.job);
  }
  const updated = await prisma.atsCheck.update({ where: { id: c.id }, data });
  res.json(view(updated));
});

/** The fixed copy as a PDF (checks without a match; with a match, the tailored CV is on Job review). */
atsRouter.get('/checks/:id/pdf', async (req, res) => {
  const c = await ownedCheck(currentUser(req).id, String(req.params.id));
  const blocks = c.copyJson ? asArray<Block>(c.copyJson) : plainCv(asObject<ProfileData>(c.profileJson, {} as ProfileData));
  const pdf = await renderPdf(blocks, 'CV');
  const name = (asObject<ProfileData>(c.profileJson, {} as ProfileData).fullName || 'CV').replace(/[^A-Za-z0-9]+/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-CV-${formatUkDate(new Date()).replace(/\s/g, '-')}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});
