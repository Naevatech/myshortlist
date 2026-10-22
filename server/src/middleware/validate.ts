import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { badRequest } from '../utils/errors.js';

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export const validateBody =
  <S extends z.ZodTypeAny>(schema: S) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body ?? {});
    if (!r.success) return next(badRequest('invalid_request', 'Some of the details are not valid.', r.error.flatten()));
    req.body = r.data;
    next();
  };

export function parseQuery<S extends z.ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  const r = schema.safeParse(req.query);
  if (!r.success) throw badRequest('invalid_request', 'Some of the details are not valid.', r.error.flatten());
  return r.data;
}
