import rateLimit from 'express-rate-limit';
import { getCacheService } from '../config/redis';

/**
 * Rate limiter for public endpoints
 */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_PUBLIC || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
  },
  skip: (req) => {
    // Skip rate limiting in test mode
    return process.env.NODE_ENV === 'test';
  },
});

/**
 * Rate limiter for admin endpoints
 */
export const adminRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_ADMIN || '1000', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Please slow down',
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
});

/**
 * Stricter rate limiter for authentication endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes',
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
});

/**
 * Custom Redis-based rate limiter
 */
export function createRedisRateLimiter(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: any) => string;
}) {
  const cache = getCacheService();

  return async (req: any, res: any, next: any) => {
    try {
      const key = options.keyGenerator
        ? options.keyGenerator(req)
        : `rate-limit:${req.ip}:${req.path}`;

      const ttl = Math.floor(options.windowMs / 1000);
      const current = await cache.incrWithExpiry(key, ttl);

      // Set headers
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - current));

      if (current > options.max) {
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded',
          retryAfter: await cache.ttl(key),
        });
      }

      next();
    } catch (error) {
      // If Redis fails, don't block the request
      next();
    }
  };
}

export default {
  publicRateLimiter,
  adminRateLimiter,
  authRateLimiter,
  createRedisRateLimiter,
};
