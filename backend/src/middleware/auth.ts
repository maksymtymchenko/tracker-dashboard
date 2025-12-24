import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

export interface SessionUser {
  username: string;
  role: 'admin' | 'user';
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

/**
 * Requires any authenticated user
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

/**
 * Requires admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

/**
 * Requires a shared collector token when configured.
 * Protects ingestion endpoints from unauthenticated abuse.
 */
export function requireCollectorToken(req: Request, res: Response, next: NextFunction) {
  const required = process.env.COLLECTOR_TOKEN;
  if (!required) return next();
  const provided = req.header('x-collector-token') || '';
  const providedBuf = Buffer.from(provided);
  const requiredBuf = Buffer.from(required);
  if (providedBuf.length !== requiredBuf.length) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!timingSafeEqual(providedBuf, requiredBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

