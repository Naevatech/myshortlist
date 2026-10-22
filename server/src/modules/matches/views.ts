import type { Application, Document, FormAnswer, Job, Match } from '@prisma/client';
import { asArray } from '../../utils/json.js';
import { answerHint } from '../../services/tailoring.js';
import { jobFacts } from '../../services/jobs/details.js';
import type { Block } from '../../types/domain.js';

export const jobView = (j: Job) => ({
  id: j.id,
  title: j.title,
  company: j.company,
  location: j.location,
  workMode: j.workMode,
  workModeDetail: j.workModeDetail,
  salaryMin: j.salaryMin,
  salaryMax: j.salaryMax,
  applyRoute: j.applyRoute,
  postedAt: j.postedAt.toISOString(),
});

export const jobDetailView = (j: Job) => ({
  ...jobView(j),
  description: j.description,
  requirements: asArray<string>(j.requirementsJson),
  applyUrl: j.applyUrl,
  facts: jobFacts(j),
});

export const matchListView = (m: Match & { job: Job }) => ({
  id: m.id,
  score: m.score,
  reasonLine: m.reasonLine,
  status: m.status,
  job: jobView(m.job),
});

export const documentView = (d: Document) => ({
  id: d.id,
  type: d.type,
  blocks: asArray<Block>(d.blocksJson),
  editedByUser: d.editedByUser,
  version: d.version,
  updatedAt: d.updatedAt,
});

export const applicationBrief = (a: Application) => ({
  id: a.id,
  status: a.status,
  route: a.route,
  scheduledSendAt: a.scheduledSendAt,
  sentAt: a.sentAt,
  undoneAt: a.undoneAt,
  sendError: a.sendError,
});

export const answerView = (a: FormAnswer) => ({
  id: a.id,
  key: a.key,
  label: a.label,
  value: a.value,
  source: a.source,
  needsAttention: a.needsAttention,
  multiline: a.multiline,
  hint: answerHint(a),
});
