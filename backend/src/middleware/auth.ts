import { Request, Response, NextFunction } from 'express';

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


