import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';
import { csrf } from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { cvRouter } from './modules/cv/routes.js';
import { onboardingRouter } from './modules/onboarding/routes.js';
import { profileRouter } from './modules/profile/routes.js';
import { preferencesRouter } from './modules/preferences/routes.js';
import { matchesRouter } from './modules/matches/routes.js';
import { documentsRouter } from './modules/documents/routes.js';
import { applicationsRouter } from './modules/applications/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { cronRouter } from './modules/cron/routes.js';
import { serveClient } from './web.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.isProd ? 1 : false);

  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        serializers: { req: (req) => ({ method: req.method, url: req.url?.split('?')[0] }), res: (res) => ({ status: res.statusCode }) },
      }),
    );
  }

  const api = express.Router();
  // The API returns data only, so its security policy allows nothing to load.
  api.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  api.use(apiLimiter);
  api.use(csrf);

  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });
  api.get('/config', (_req, res) => {
    res.json({
      googleEnabled: env.googleEnabled,
      undoWindowSeconds: env.UNDO_WINDOW_SECONDS,
      otpTtlMinutes: env.OTP_TTL_MINUTES,
      maxCvSizeMb: env.MAX_CV_SIZE_MB,
      minPasswordLength: env.MIN_PASSWORD_LENGTH,
      passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
    });
  });

  api.use('/auth', authRouter);
  api.use('/me', usersRouter);
  api.use('/cv', cvRouter);
  api.use('/onboarding', onboardingRouter);
  api.use('/profile', profileRouter);
  api.use('/preferences', preferencesRouter);
  api.use('/matches', matchesRouter);
  api.use('/documents', documentsRouter);
  api.use('/applications', applicationsRouter);
  api.use('/settings', settingsRouter);
  api.use('/cron', cronRouter);

  app.use('/api', api);
  serveClient(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
