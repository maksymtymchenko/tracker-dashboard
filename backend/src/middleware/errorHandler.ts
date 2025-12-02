import { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Central error handler middleware
 * Prevents information disclosure in production
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof Error && (err as any).status ? (err as any).status : 500;
  
  // Log detailed error server-side
  if (err instanceof Error) {
    console.error('[ERROR]', {
      message: err.message,
      stack: err.stack,
      status,
      path: _req.path,
      method: _req.method,
    });
  } else {
    console.error('[ERROR]', { error: err, status, path: _req.path, method: _req.method });
  }

  // In production, don't expose error details to clients
  if (isProduction) {
    if (status >= 500) {
      return res.status(status).json({ error: 'Internal server error' });
    }
    // For client errors (4xx), we can be more specific but still sanitized
    const message = err instanceof Error ? err.message : 'Bad request';
    // Only return safe error messages for known error types
    if (status < 500 && message.length < 100) {
      return res.status(status).json({ error: message });
    }
    return res.status(status).json({ error: 'Bad request' });
  }

  // In development, show full error details
  const message = err instanceof Error ? err.message : 'Unexpected error';
  res.status(status).json({ 
    error: message,
    ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
  });
}


