import { Router } from 'express';
import { healthCheck as dbHealthCheck } from '../config/database';
import { redisHealthCheck } from '../config/redis';
import { getTautulliService } from '../services/tautulli.service';
import { getOverseerrService } from '../services/overseerr.service';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
}));

/**
 * GET /api/health/detailed
 * Detailed health check with all services
 */
router.get('/detailed', asyncHandler(async (req, res) => {
  const tautulli = getTautulliService();
  const overseerr = getOverseerrService();

  // Check all services
  const [database, redis, tautulliCheck, overseerrCheck] = await Promise.all([
    dbHealthCheck().catch(() => false),
    redisHealthCheck().catch(() => false),
    tautulli.healthCheck().catch(() => ({ healthy: false, message: 'Connection failed' })),
    overseerr.healthCheck().catch(() => ({ healthy: false, message: 'Connection failed' })),
  ]);

  const allHealthy = database && redis && tautulliCheck.healthy;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        healthy: database,
        message: database ? 'Connected' : 'Disconnected',
      },
      redis: {
        healthy: redis,
        message: redis ? 'Connected' : 'Disconnected',
      },
      tautulli: {
        healthy: tautulliCheck.healthy,
        message: tautulliCheck.message,
      },
      overseerr: {
        healthy: overseerrCheck.healthy,
        message: overseerrCheck.message,
        enabled: overseerr.isEnabled(),
      },
    },
  });
}));

export default router;
