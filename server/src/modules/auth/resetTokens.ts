import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { email } from '../../services/email/index.js';
import { passwordResetEmail } from '../../services/email/templates.js';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Creates a single-use reset link and emails it. Only the SHA-256 hash of the token is stored.
 * Earlier unused links for the user stop working.
 */
export async function sendResetLink(user: User, ip?: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + env.PASSWORD_RESET_TTL_MINUTES * 60_000),
      ip: ip?.slice(0, 64),
    },
  });
  await email().send(passwordResetEmail(user.email, `${env.APP_URL}/reset?token=${encodeURIComponent(token)}`));
}

/** The token row if the link is still usable (exists, unused, not expired). */
export async function findUsableToken(token: string, now = new Date()) {
  if (!token || token.length > 200) return null;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt <= now) return null;
  return row;
}

/** Marks the token used. Returns false if it was already used or has expired (so a link works once). */
export async function consumeToken(id: string, now = new Date()) {
  const res = await prisma.passwordResetToken.updateMany({
    where: { id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  return res.count === 1;
}
