import type { Request, Response, NextFunction, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';

/** Error with an HTTP status that the error handler turns into `{ error }`. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps an async route so thrown errors reach the error handler instead of crashing. */
export const ah = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

export const isId = (v: unknown): v is string =>
  typeof v === 'string' && mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(v);

/** Throws 404 when an id from the URL is not a valid ObjectId. */
export function requireId(v: unknown, what = 'Resource'): string {
  if (!isId(v)) throw new HttpError(404, `${what} not found`);
  return v;
}

/** Sends the first express-validator error as `{ error }`. Returns true if it responded. */
export function sendValidationError(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ error: errors.array()[0].msg });
  return true;
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  if (err?.name === 'CastError') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors ?? {})[0] as any;
    return res.status(400).json({ error: first?.message ?? 'Invalid data.' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'That already exists.' });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
