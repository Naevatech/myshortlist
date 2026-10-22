import type { Job, Match } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { notFound } from '../../utils/errors.js';

/** Loads a match the user owns. Anyone else gets a 404, so ids cannot be probed. */
export async function ownedMatch(userId: string, matchId: string): Promise<Match & { job: Job }> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { job: true } });
  if (!match || match.userId !== userId) throw notFound('We could not find this job.');
  return match;
}

/** The application for this match that is still live (not undone). */
export function activeApplication(matchId: string) {
  return prisma.application.findFirst({
    where: { matchId, undoneAt: null, status: { not: 'withdrawn' } },
    orderBy: { createdAt: 'desc' },
  });
}
