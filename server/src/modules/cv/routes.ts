import { Router } from 'express';
import multer from 'multer';
import { createId } from '../../utils/id.js';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { toJson } from '../../utils/json.js';
import { badRequest } from '../../utils/errors.js';
import { audit } from '../../utils/audit.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { DOCX_MIME, PDF_MIME, detectCvType, extractText, parseCv } from '../../services/cvParser.js';
import { storage } from '../../services/storage/index.js';
import type { ParsedCv } from '../../types/domain.js';

export const cvRouter = Router();
cvRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_CV_SIZE_MB * 1024 * 1024, files: 1 },
});

const READ_FAILED = 'We could not read this file. Try a PDF or Word document.';

/** What the confirmation screen shows. */
export function cvSummary(parsed: ParsedCv, fileName: string) {
  const latest = parsed.experience[0];
  return {
    fileName,
    name: parsed.name,
    latestRole: latest ? [latest.title, latest.company].filter(Boolean).join(', ') : '',
    yearsExperience: parsed.yearsExperience,
    skills: parsed.skills,
    education: parsed.education[0] ? [parsed.education[0].qualification, parsed.education[0].institution].filter(Boolean).join(', ') : '',
    suggestedRoles: [...new Set(parsed.experience.map((e) => e.title).filter(Boolean))].slice(0, 3),
    location: parsed.location,
  };
}

cvRouter.post('/', upload.single('file'), async (req, res) => {
  const user = currentUser(req);
  const file = req.file;
  if (!file) throw badRequest('no_file', 'Choose a file to upload.');
  if (![PDF_MIME, DOCX_MIME].includes(file.mimetype)) throw badRequest('invalid_file', READ_FAILED);
  const kind = detectCvType(file.buffer);
  if (!kind || (kind === 'pdf') !== (file.mimetype === PDF_MIME)) throw badRequest('invalid_file', READ_FAILED);

  let rawText: string;
  try {
    rawText = await extractText(file.buffer, kind);
  } catch {
    throw badRequest('invalid_file', READ_FAILED);
  }
  if (rawText.replace(/\s/g, '').length < 30) throw badRequest('invalid_file', READ_FAILED);

  const parsed = await parseCv(rawText);
  const fileName = file.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 200) || `cv.${kind}`;
  const fileKey = `cv/${user.id}/${createId()}.${kind}`;
  await storage().put(fileKey, file.buffer, file.mimetype);

  const profileData = {
    fullName: parsed.name || user.name || '',
    email: parsed.email || user.email,
    phone: parsed.phone || null,
    location: parsed.location,
    headline: parsed.headline,
    summary: parsed.summary,
    experienceJson: toJson(parsed.experience),
    educationJson: toJson(parsed.education),
    skillsJson: toJson(parsed.skills),
  };
  await prisma.$transaction([
    prisma.cv.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false } }),
    prisma.cv.create({
      data: { userId: user.id, fileKey, fileName, mime: file.mimetype, size: file.size, rawText, parsedJson: toJson(parsed) },
    }),
    prisma.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...profileData }, update: profileData }),
    ...(parsed.name && !user.name ? [prisma.user.update({ where: { id: user.id }, data: { name: parsed.name } })] : []),
  ]);
  await audit(user.id, 'cv.uploaded', { kind, size: file.size });
  res.status(201).json(cvSummary(parsed, fileName));
});

cvRouter.get('/active', async (req, res) => {
  const user = currentUser(req);
  const cv = await prisma.cv.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { createdAt: 'desc' } });
  if (!cv) return res.json(null);
  res.json({ ...cvSummary(cv.parsedJson as unknown as ParsedCv, cv.fileName), size: cv.size, uploadedAt: cv.createdAt });
});
