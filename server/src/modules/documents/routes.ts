import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { asArray, toJson } from '../../utils/json.js';
import { conflict, notFound } from '../../utils/errors.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { renderPdf } from '../../services/pdf.js';
import { storage } from '../../services/storage/index.js';
import { blocksSchema, type Block } from '../../types/domain.js';
import { documentView } from '../matches/views.js';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

async function ownedDocument(userId: string, id: string) {
  const doc = await prisma.document.findUnique({ where: { id }, include: { match: { include: { job: true } } } });
  if (!doc || doc.match.userId !== userId) throw notFound('We could not find this document.');
  return doc;
}

/** Saves the user's edits. Their wording is no longer marked as adjusted. */
documentsRouter.put('/:id', validateBody(z.object({ blocks: blocksSchema })), async (req, res) => {
  const doc = await ownedDocument(currentUser(req).id, String(req.params.id));
  if (doc.match.status === 'applied') throw conflict('already_applied', 'This document was already sent.');
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { blocksJson: toJson(req.body.blocks as Block[]), editedByUser: true, version: { increment: 1 }, pdfKey: null },
  });
  res.json(documentView(updated));
});

/** Serves the stored PDF that was sent, or renders the current version. */
documentsRouter.get('/:id/pdf', async (req, res) => {
  const doc = await ownedDocument(currentUser(req).id, String(req.params.id));
  const pdf = doc.pdfKey
    ? await storage().get(doc.pdfKey)
    : await renderPdf(asArray<Block>(doc.blocksJson), doc.type === 'cv' ? 'CV' : 'Cover letter');
  const name = `${doc.type === 'cv' ? 'CV' : 'Cover-letter'}-${doc.match.job.company.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});
