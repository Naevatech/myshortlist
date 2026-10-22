import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Keyed SHA-256, used for OTP codes and refresh tokens so the database never holds the raw value. */
export function hashSecret(value: string): string {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sixDigitCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function encryptionKey(): Buffer {
  const k = env.ENCRYPTION_KEY;
  return /^[0-9a-f]{64}$/i.test(k) ? Buffer.from(k, 'hex') : crypto.createHash('sha256').update(k).digest();
}

/** AES-256-GCM for any stored third-party tokens. Output: iv.tag.ciphertext, base64url. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
