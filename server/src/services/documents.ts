import type { Job } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { toJson } from '../utils/json.js';
import { draftAnswers, tailorDocuments } from './tailoring.js';
import type { PreferencesData, ProfileData } from '../types/domain.js';

/** Writes (or rewrites) the tailored CV and cover letter for a match, and the form answers for "form" jobs. */
export async function generateForMatch(
  matchId: string,
  job: Job,
  profile: ProfileData,
  prefs: PreferencesData,
  opts: { answers?: boolean } = { answers: true },
) {
  const docs = await tailorDocuments(profile, job);
  for (const [type, d] of [
    ['cv', docs.cv],
    ['cover_letter', docs.coverLetter],
  ] as const) {
    await prisma.document.upsert({
      where: { matchId_type: { matchId, type } },
      create: { matchId, type, blocksJson: toJson(d.blocks), promptVersion: d.promptVersion },
      update: {
        blocksJson: toJson(d.blocks),
        promptVersion: d.promptVersion,
        editedByUser: false,
        version: { increment: 1 },
        pdfKey: null,
      },
    });
  }

  if (job.applyRoute === 'form' && opts.answers !== false) {
    const answers = await draftAnswers(profile, prefs, job);
    await prisma.formAnswer.deleteMany({ where: { matchId } });
    await prisma.formAnswer.createMany({
      data: answers.map((a, i) => ({ matchId, ...a, position: i })),
    });
  }
}
