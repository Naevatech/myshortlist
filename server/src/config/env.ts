import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Values already in process.env (for example from tests or the host) win over the file.
dotenv.config({ path: path.join(serverRoot, '.env') });

/** Treats empty strings as "not set" so optional keys can be left blank in .env. */
const optional = () =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const int = (def: number) => z.coerce.number().int().default(def);

/** The choices offered in Settings. */
export const MATCHES_PER_DAY_OPTIONS = [3, 5, 10, 15, 20, 25, 30] as const;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(4000),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.string().startsWith('mysql://', 'DATABASE_URL must start with mysql://'),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: optional(),
  // Email verification codes (sign up only).
  OTP_TTL_MINUTES: int(10),
  OTP_MAX_ATTEMPTS: int(5),
  ENCRYPTION_KEY: z.string().min(1),
  PASSWORD_RESET_TTL_MINUTES: int(30).pipe(z.number().min(5).max(24 * 60)),
  MIN_PASSWORD_LENGTH: int(8).pipe(z.number().min(8).max(64)),

  GOOGLE_CLIENT_ID: optional(),
  GOOGLE_CLIENT_SECRET: optional(),
  GOOGLE_REDIRECT_URI: optional(),

  EMAIL_PROVIDER: z.enum(['resend']).default('resend'),
  RESEND_API_KEY: optional(),
  EMAIL_FROM: z.string().default('Shortlist <hello@example.com>'),

  AI_PROVIDER: z.enum(['groq', 'openai']).default('groq'),
  GROQ_API_KEY: optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  OPENAI_API_KEY: optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // One source, or several separated by commas, for example "adzuna,reed".
  JOB_PROVIDER: z
    .string()
    .default('placeholder')
    .transform((v) => v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).join(','))
    .refine((v) => v.length > 0 && v.split(',').every((s) => ['placeholder', 'adzuna', 'reed', 'custom'].includes(s)), {
      message: 'use placeholder, adzuna, reed or custom, or several joined by commas (adzuna,reed)',
    }),
  JOBS_API_BASE_URL: optional(),
  JOBS_API_KEY: optional(),
  ADZUNA_APP_ID: optional(),
  ADZUNA_APP_KEY: optional(),
  REED_API_KEY: optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  S3_ENDPOINT: optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: optional(),
  S3_ACCESS_KEY_ID: optional(),
  S3_SECRET_ACCESS_KEY: optional(),
  MAX_CV_SIZE_MB: z.coerce.number().positive().default(5),

  CRON_SECRET: z.string().min(1),
  DAILY_MATCH_HOUR: int(7).pipe(z.number().min(0).max(23)),
  DEFAULT_MATCHES_PER_DAY: int(5).refine((n) => (MATCHES_PER_DAY_OPTIONS as readonly number[]).includes(n), {
    message: `use one of ${MATCHES_PER_DAY_OPTIONS.join(', ')}`,
  }),
  MAX_MATCHES_PER_DAY: int(30).pipe(z.number().min(3).max(30)),
  // Only fetch and show jobs posted within this window, in days.
  JOBS_MAX_AGE_DAYS: int(14).pipe(z.number().min(1).max(30)),
  JOBS_MIN_AGE_DAYS: int(0).pipe(z.number().min(0).max(30)),
  // Matches stay under Earlier until their job is this many days old, then are removed (not applied or started ones).
  JOB_RETENTION_DAYS: int(21).pipe(z.number().min(1).max(90)),
  UNDO_WINDOW_SECONDS: int(10).pipe(z.number().min(1).max(600)),

  // Production hosting: serve client/dist from this server (on in production) and run the schedulers in this
  // process (sending approved applications, the morning matches). Set RUN_SCHEDULER=true on hosts without cron.
  SERVE_CLIENT: optional().transform((v) => v === 'true'),
  CLIENT_DIST: optional(),
  RUN_SCHEDULER: optional().transform((v) => (v === undefined ? undefined : v === 'true')),

  BROWSERBASE_API_KEY: optional(),
  BROWSERBASE_PROJECT_ID: optional(),
  STRIPE_SECRET_KEY: optional(),
  STRIPE_WEBHOOK_SECRET: optional(),
  SENTRY_DSN: optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    console.error(`\nShortlist could not start because server/.env is not valid:\n${lines.join('\n')}\n`);
    console.error('Compare it with server/.env.example.\n');
    process.exit(1);
  }
  const env = parsed.data;

  const rangeErrors: string[] = [];
  if (env.JOBS_MIN_AGE_DAYS > env.JOBS_MAX_AGE_DAYS) rangeErrors.push('JOBS_MIN_AGE_DAYS must not be more than JOBS_MAX_AGE_DAYS');
  if (env.JOB_RETENTION_DAYS < env.JOBS_MAX_AGE_DAYS) rangeErrors.push('JOB_RETENTION_DAYS must not be less than JOBS_MAX_AGE_DAYS');
  if (env.DEFAULT_MATCHES_PER_DAY > env.MAX_MATCHES_PER_DAY) rangeErrors.push('DEFAULT_MATCHES_PER_DAY must not be more than MAX_MATCHES_PER_DAY');
  if (rangeErrors.length) {
    const list = rangeErrors.map((e) => `  - ${e}`).join('\n');
    console.error(`\nShortlist could not start because server/.env is not valid:\n${list}\n`);
    process.exit(1);
  }

  if (env.NODE_ENV === 'production') {
    const weak = (['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY', 'CRON_SECRET'] as const).filter(
      (k) => env[k] === 'change-me' || env[k].length < 32,
    );
    if (weak.length) {
      console.error(`\nSet strong values for ${weak.join(', ')} before running in production (openssl rand -hex 32).\n`);
      process.exit(1);
    }
  }
  if (env.STORAGE_DRIVER === 's3' && !(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY)) {
    console.error('\nSTORAGE_DRIVER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.\n');
    process.exit(1);
  }

  return {
    ...env,
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    serverRoot,
    // In development the schedulers always run here; in production only when RUN_SCHEDULER=true.
    runScheduler: env.RUN_SCHEDULER ?? env.NODE_ENV === 'development',
    uploadDir: path.resolve(serverRoot, env.UPLOAD_DIR),
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    emailEnabled: Boolean(env.RESEND_API_KEY),
  };
}

export const env = load();
export type Env = typeof env;
