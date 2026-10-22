import type { Sender } from './index.js';

/**
 * Version 1 stub. Submitting employer forms needs browser automation (for example Browserbase, whose keys are
 * already in .env.example). Implement send() with that, using the user's checked FormAnswer rows, and return
 * { ok: true, dryRun: false } on success. Until then the user finishes on the employer's site.
 */
export const formSender: Sender = {
  route: 'form',
  async send() {
    return { ok: false, reason: 'not_supported' };
  },
};
