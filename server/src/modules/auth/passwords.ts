import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';

/** bcrypt cost 12 in real use. Tests use a low cost so the suite stays fast. */
const COST = env.isTest ? 4 : 12;
/** bcrypt only reads the first 72 bytes, so longer passwords are refused rather than silently cut. */
export const MAX_PASSWORD_BYTES = 72;

export const hashPassword = (password: string) => bcrypt.hash(password, COST);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Compared against when the email is unknown, so a wrong email takes as long as a wrong password. */
let dummyHash: string | undefined;
export async function burnTime(password: string) {
  dummyHash ??= await bcrypt.hash(crypto.randomBytes(16).toString('hex'), COST);
  await bcrypt.compare(password, dummyHash);
}

/** A short list of the most common passwords. Real breaches use these first. */
const COMMON = new Set(
  `password password1 password12 password123 password1234 passw0rd p@ssw0rd p@ssword 12345678 123456789 1234567890
  12341234 11111111 00000000 87654321 qwertyui qwerty12 qwerty123 qwertyuiop 1q2w3e4r 1q2w3e4r5t zaq12wsx
  iloveyou iloveyou1 sunshine sunshine1 princess football football1 baseball welcome1 welcome123 letmein1
  abc12345 abcd1234 admin123 administrator trustno1 superman batman123 starwars whatever dragon12 monkey12
  master12 shadow12 michael1 charlie1 liverpool chelsea1 arsenal1 manchester computer internet changeme
  changeme1 secret12 qazwsx123 asdfghjk asdf1234 zxcvbnm1 1qaz2wsx shortlist shortlist1 shortlist123`.split(/\s+/),
);

/** Returns the message to show, or null when the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < env.MIN_PASSWORD_LENGTH) return `Use at least ${env.MIN_PASSWORD_LENGTH} characters.`;
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) return 'Use a password of 72 characters or fewer.';
  if (COMMON.has(password.toLowerCase())) return 'That password is too common. Choose another one.';
  return null;
}
