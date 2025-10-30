import { Request, Response, NextFunction } from 'express';

/**
 * Central error handler middleware
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  const status = err instanceof Error && (err as any).status ? (err as any).status : 500;
  res.status(status).json({ error: message });
}


