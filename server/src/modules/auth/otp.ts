import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { hashSecret, safeEqual, sixDigitCode } from '../../utils/crypto.js';
import { email } from '../../services/email/index.js';
import { signInCodeEmail } from '../../services/email/templates.js';

export const normaliseEmail = (e: string) => e.trim().toLowerCase();

/** Creates a new code for the address (invalidating earlier ones) and emails it. */
export async function sendCode(address: string) {
  const code = sixDigitCode();
  await prisma.otpCode.updateMany({ where: { email: address, consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.otpCode.create({
    data: { email: address, codeHash: hashSecret(`${address}:${code}`), expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000) },
  });
  await email().send(signInCodeEmail(address, code));
}

export type VerifyResult = 'ok' | 'invalid' | 'expired';

/** Checks a code. Expired codes trigger a fresh one; too many attempts invalidate the code. */
export async function checkCode(address: string, code: string): Promise<VerifyResult> {
  const row = await prisma.otpCode.findFirst({
    where: { email: address, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return 'invalid';
  if (row.expiresAt < new Date()) {
    await sendCode(address);
    return 'expired';
  }
  if (row.attempts >= env.OTP_MAX_ATTEMPTS) return 'invalid';
  if (!safeEqual(row.codeHash, hashSecret(`${address}:${code}`))) {
    await prisma.otpCode.update({
      where: { id: row.id },
      data: {
        attempts: { increment: 1 },
        // Used up: the next attempt needs a new code.
        consumedAt: row.attempts + 1 >= env.OTP_MAX_ATTEMPTS ? new Date() : undefined,
      },
    });
    return 'invalid';
  }
  const consumed = await prisma.otpCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return consumed.count === 1 ? 'ok' : 'invalid';
}
