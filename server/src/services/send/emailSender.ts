import { email } from '../email/index.js';
import { employerApplicationEmail } from '../email/templates.js';
import { renderPdf } from '../pdf.js';
import { storage } from '../storage/index.js';
import { asArray } from '../../utils/json.js';
import { logger } from '../../utils/logger.js';
import type { Block } from '../../types/domain.js';
import type { Sender } from './index.js';

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Emails the approved CV and cover letter (PDF) to the employer, with Reply-To set to the applicant. */
export const emailSender: Sender = {
  route: 'email',
  async send({ application, job, user, profile, documents }) {
    if (!job.applyEmail) return { ok: false, reason: 'failed', message: 'This listing has no application email address.' };
    const cv = documents.find((d) => d.type === 'cv');
    const letter = documents.find((d) => d.type === 'cover_letter');
    if (!cv || !letter) return { ok: false, reason: 'failed', message: 'The documents are missing.' };

    const name = profile.fullName || user.name || 'Applicant';
    const [cvPdf, letterPdf] = await Promise.all([
      renderPdf(asArray<Block>(cv.blocksJson), `${name} CV`),
      renderPdf(asArray<Block>(letter.blocksJson), `${name} cover letter`),
    ]);

    // Keep exactly what was sent, so Application detail shows the same files.
    const base = `sent/${user.id}/${application.id}`;
    const pdfKeys = { cv: `${base}/cv.pdf`, cover_letter: `${base}/cover-letter.pdf` };
    await storage().put(pdfKeys.cv, cvPdf, 'application/pdf');
    await storage().put(pdfKeys.cover_letter, letterPdf, 'application/pdf');

    const res = await email().send(
      employerApplicationEmail({
        to: job.applyEmail,
        applicantName: name,
        applicantEmail: profile.email || user.email,
        jobTitle: job.title,
        company: job.company,
        attachments: [
          { filename: `${slug(name)}-CV.pdf`, content: cvPdf },
          { filename: `${slug(name)}-cover-letter.pdf`, content: letterPdf },
        ],
      }),
    );
    if (res.dryRun) logger.info({ applicationId: application.id }, 'email route: would send (no email key, dry run)');
    return { ok: true, dryRun: res.dryRun, detail: res.dryRun ? 'dryRun' : undefined, pdfKeys };
  },
};
