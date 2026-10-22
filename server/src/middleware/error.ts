import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? `That file is larger than ${env.MAX_CV_SIZE_MB} MB.` : 'We could not read this file.';
    return res.status(400).json({ error: { code: 'invalid_file', message } });
  }
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'The request was not valid JSON.' } });
  }
  logger.error({ err: (err as Error)?.message, stack: (err as Error)?.stack, path: req.path }, 'unhandled error');
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong on our side. Try again.' } });
}
