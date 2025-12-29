import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Log request
  logger.http(`${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logRequest(req, res.statusCode, duration);
  });

  next();
}

/**
 * Skip logging for health check endpoints
 */
export function skipHealthCheck(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }
  return requestLogger(req, res, next);
}

export default {
  requestLogger,
  skipHealthCheck,
};
