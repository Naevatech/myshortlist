import type { Application, Document, Job, User } from '@prisma/client';
import { emailSender } from './emailSender.js';
import { formSender } from './formSender.js';
import { siteSender } from './siteSender.js';
import type { ProfileData } from '../../types/domain.js';

export interface SendContext {
  application: Application;
  job: Job;
  user: User;
  profile: ProfileData;
  documents: Document[];
}

export type SendResult =
  | { ok: true; dryRun: boolean; detail?: string; pdfKeys?: Partial<Record<'cv' | 'cover_letter', string>> }
  | { ok: false; reason: 'not_supported' | 'user_action' | 'failed'; message?: string };

/** One sender per apply route. Browser automation for forms can be added by replacing formSender. */
export interface Sender {
  route: 'email' | 'form' | 'site';
  send(ctx: SendContext): Promise<SendResult>;
}

export function senderFor(route: Job['applyRoute']): Sender {
  return { email: emailSender, form: formSender, site: siteSender }[route];
}
