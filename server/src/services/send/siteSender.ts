import type { Sender } from './index.js';

/** The "site" route never sends anything: the user applies on the employer's site and tells us. */
export const siteSender: Sender = {
  route: 'site',
  async send() {
    return { ok: false, reason: 'user_action' };
  },
};
