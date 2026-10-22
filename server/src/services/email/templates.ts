import { env } from '../../config/env.js';
import { escapeHtml } from '../../utils/format.js';
import type { EmailMessage } from './index.js';

/** Plain, short emails. Sentence-case subjects, no marketing. */
const wrap = (body: string) =>
  `<div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111111;max-width:520px">${body}</div>`;

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1F3A5F;color:#ffffff;` +
  `text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500">${escapeHtml(label)}</a></p>`;

export function signInCodeEmail(to: string, code: string): EmailMessage {
  const mins = env.OTP_TTL_MINUTES;
  return {
    to,
    subject: `Your Shortlist code is ${code}`,
    text: `Your code is ${code}. It expires in ${mins} minutes.\n\nIf you did not ask for this, you can ignore this email.`,
    html: wrap(
      `<p>Your code is</p><p style="font-size:32px;font-weight:500;letter-spacing:4px;margin:8px 0">${code}</p>` +
        `<p style="color:#6B6B6B">It expires in ${mins} minutes. If you did not ask for this, you can ignore this email.</p>`,
    ),
  };
}

export function passwordResetEmail(to: string, link: string): EmailMessage {
  const mins = env.PASSWORD_RESET_TTL_MINUTES;
  return {
    to,
    subject: 'Reset your Shortlist password',
    text:
      `Use this link to choose a new password. It works once and expires in ${mins} minutes.\n\n${link}\n\n` +
      'If you did not ask for this, you can ignore this email. Your password has not changed.',
    html: wrap(
      `<p>Use this link to choose a new password. It works once and expires in ${mins} minutes.</p>` +
        button(link, 'Choose a new password') +
        '<p style="color:#6B6B6B">If you did not ask for this, you can ignore this email. Your password has not changed.</p>',
    ),
  };
}

export function newMatchesEmail(to: string, n: number): EmailMessage {
  const line = n === 1 ? 'You have 1 new match to review.' : `You have ${n} new matches to review.`;
  const href = `${env.APP_URL}/today`;
  return {
    to,
    subject: n === 1 ? 'A new match is ready for you' : 'New matches are ready for you',
    text: `${line}\n\nReview them: ${href}\n\nNothing is sent until you approve it.`,
    html: wrap(
      `<p>${line}</p>${button(href, 'Review your matches')}<p style="color:#6B6B6B">Nothing is sent until you approve it.</p>`,
    ),
  };
}

export function employerApplicationEmail(opts: {
  to: string;
  applicantName: string;
  applicantEmail: string;
  jobTitle: string;
  company: string;
  attachments: EmailMessage['attachments'];
}): EmailMessage {
  const text =
    `Dear Hiring Team,\n\nPlease find attached my CV and cover letter for the ${opts.jobTitle} role at ${opts.company}.\n\n` +
    `You can reply to this email to reach me directly.\n\nKind regards,\n${opts.applicantName}`;
  return {
    to: opts.to,
    subject: `Application for ${opts.jobTitle}: ${opts.applicantName}`,
    text,
    html: wrap(escapeHtml(text).replace(/\n/g, '<br>')),
    replyTo: opts.applicantEmail,
    attachments: opts.attachments,
  };
}

export function applicationUpdateEmail(to: string, jobTitle: string, company: string, update: string): EmailMessage {
  const href = `${env.APP_URL}/applications`;
  return {
    to,
    subject: `Update on your application to ${company}`,
    text: `${update}\n\nRole: ${jobTitle}, ${company}\n\nSee the details: ${href}`,
    html: wrap(
      `<p>${escapeHtml(update)}</p><p style="color:#6B6B6B">${escapeHtml(jobTitle)}, ${escapeHtml(company)}</p>` +
        button(href, 'View applications'),
    ),
  };
}
