import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

/**
 * In production the API also serves the built website (client/dist), so the app and /api share one domain:
 * no cross-site cookies and no CORS setup. Off in development, where Vite serves the client.
 */
export function serveClient(app: Express) {
  if (!env.isProd && !env.SERVE_CLIENT) return;
  const dist = env.CLIENT_DIST ?? path.resolve(env.serverRoot, '../client/dist');
  const index = path.join(dist, 'index.html');
  if (!fs.existsSync(index)) {
    logger.warn({ dist }, 'client build not found: the website is not served (run npm run build)');
    return;
  }

  // The website's own security policy. The API keeps its stricter one.
  const pageHeaders = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://img.logo.dev'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
  });

  // Hashed build files can be cached for a year; index.html and the service worker never are.
  app.use(
    pageHeaders,
    express.static(dist, {
      index: false,
      setHeaders: (res, file) => {
        const name = path.basename(file);
        const hashed = file.includes(`${path.sep}assets${path.sep}`);
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : name === 'sw.js' ? 'no-cache' : 'public, max-age=3600');
      },
    }),
  );

  // Every other page address is handled by the app's router.
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) return next();
    pageHeaders(req, res, () => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
    });
  });
  logger.info({ dist }, 'serving the website');
}
