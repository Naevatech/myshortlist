import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.isTest ? 'silent' : env.isProd ? 'info' : 'debug',
  // Never log personal data: these keys are removed if they ever appear in a log object.
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', 'email', 'code', 'token', 'rawText', '*.email', '*.code'],
    remove: true,
  },
  transport: env.isProd || env.isTest ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
