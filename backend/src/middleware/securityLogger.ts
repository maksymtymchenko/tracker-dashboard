import { Request, Response, NextFunction } from 'express';

/**
 * Security event types
 */
export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_DELETED = 'USER_DELETED',
  USER_DATA_DELETED = 'USER_DATA_DELETED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * Log security events for audit purposes
 */
export function logSecurityEvent(
  type: SecurityEventType,
  details: Record<string, unknown>,
  req: Request,
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    ...details,
  };

  // In production, this should be sent to a proper logging service
  // For now, we'll use console with structured format
  console.log('[SECURITY]', JSON.stringify(logEntry));
}

/**
 * Middleware to log security-relevant requests
 */
export function securityLogger(req: Request, _res: Response, next: NextFunction) {
  // Log all admin operations
  if (req.path.startsWith('/api/users') || 
      req.path.startsWith('/api/departments') ||
      req.path.startsWith('/api/admin')) {
    logSecurityEvent(SecurityEventType.UNAUTHORIZED_ACCESS, {
      path: req.path,
      method: req.method,
      username: (req.session as any)?.user?.username || 'anonymous',
    }, req);
  }
  
  next();
}

