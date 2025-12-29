import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { publicRateLimiter } from '../middleware/rate-limit.middleware';
import { AccessTokenModel } from '../models/AccessToken';
import { UserWrappedStatsModel } from '../models/UserWrappedStats';
import { UserModel } from '../models/User';
import logger from '../utils/logger';
import axios from 'axios';

const router = Router();

// Apply public rate limiting to all wrapped routes
router.use(publicRateLimiter);

/**
 * GET /api/wrapped/plex-image
 * Proxy Plex images through Tautulli (public endpoint for wrapped pages)
 * MUST be defined before /:token route to avoid matching issues
 */
router.get('/plex-image', asyncHandler(async (req, res) => {
  const { path } = req.query;

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    const tautulliUrl = process.env.TAUTULLI_URL;
    const tautulliApiKey = process.env.TAUTULLI_API_KEY;

    if (!tautulliUrl || !tautulliApiKey) {
      return res.status(500).json({ error: 'Tautulli not configured' });
    }

    // Decode the path if it's URL-encoded (it comes encoded from the frontend)
    const decodedPath = decodeURIComponent(path);

    // Extract rating_key from path (format: /library/metadata/{rating_key}/thumb/{timestamp})
    const match = decodedPath.match(/\/library\/metadata\/(\d+)\//);
    if (!match) {
      return res.status(400).json({ error: 'Invalid image path format' });
    }

    const ratingKey = match[1];

    // Construct Tautulli pms_image_proxy URL with rating_key
    const imageUrl = `${tautulliUrl}/api/v2?apikey=${tautulliApiKey}&cmd=pms_image_proxy&rating_key=${ratingKey}&width=300&height=450`;

    logger.debug(`Fetching image for rating_key ${ratingKey} from Tautulli`);

    // Fetch the image from Tautulli
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    // Forward the image to the client with CORS headers
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.set('Access-Control-Allow-Origin', '*'); // Allow all origins for public images
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow cross-origin resource loading
    res.send(response.data);
  } catch (error: any) {
    logger.error('Error proxying Plex image:', error.message);
    if (error.response) {
      logger.error('Axios error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data?.toString?.() || 'No data',
      });
    } else if (error.request) {
      logger.error('Axios error: No response received');
    } else {
      logger.error('Axios error:', error.toString());
    }
    res.status(500).json({ error: 'Failed to fetch image', details: error.message });
  }
}));

/**
 * GET /api/wrapped/:token
 * Get wrapped stats for a specific token
 */
router.get('/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Verify token
  const verification = await AccessTokenModel.verifyToken(token);
  if (!verification.valid) {
    return res.status(403).json({
      error: 'Invalid or expired token',
      reason: verification.reason,
    });
  }

  // Track access
  const ipAddress = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
  const userAgent = req.get('user-agent') || 'Unknown';
  await AccessTokenModel.trackAccess(token, ipAddress, userAgent);

  // Get stats
  const stats = await UserWrappedStatsModel.findById(verification.record!.user_wrapped_stats_id);
  if (!stats) {
    return res.status(404).json({
      error: 'Wrapped stats not found',
    });
  }

  // Get user info
  const user = await UserModel.findById(stats.user_id);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
    });
  }

  // Return stats
  res.json({
    user: {
      username: user.username,
      friendly_name: user.friendly_name,
      thumb: user.thumb,
    },
    year: stats.year,
    stats: {
      totalWatchTimeMinutes: stats.total_watch_time_minutes,
      totalPlays: stats.total_plays,
      totalMovies: stats.total_movies,
      totalTvEpisodes: stats.total_tv_episodes,
      uniqueMovies: stats.unique_movies,
      uniqueShows: stats.unique_shows,
      daysActive: stats.days_active,

      mostActiveMonth: stats.most_active_month,
      mostActiveDayOfWeek: stats.most_active_day_of_week,
      mostActiveHour: stats.most_active_hour,
      longestStreakDays: stats.longest_streak_days,
      longestBingeMinutes: stats.longest_binge_minutes,
      longestBingeShow: stats.longest_binge_show,

      topMovies: stats.top_movies,
      topShows: stats.top_shows,
      topEpisodes: stats.top_episodes,
      topGenres: stats.top_genres,
      topActors: stats.top_actors,
      topDirectors: stats.top_directors,

      topDevices: stats.top_devices,
      topPlatforms: stats.top_platforms,
      qualityStats: stats.quality_stats,
      monthlyStats: stats.monthly_stats,

      percentageOfLibraryWatched: stats.percentage_of_library_watched,
      totalSeasonsCompleted: stats.total_seasons_completed,
      rewatches: stats.rewatches,
      firstWatchTitle: stats.first_watch_title,
      firstWatchDate: stats.first_watch_date,
      lastWatchTitle: stats.last_watch_title,
      lastWatchDate: stats.last_watch_date,
      mostMemorableDayDate: stats.most_memorable_day_date,
      mostMemorableDayMinutes: stats.most_memorable_day_minutes,

      funFacts: stats.fun_facts,
      badges: stats.badges,
    },
    generatedAt: stats.generated_at,
  });
}));

/**
 * POST /api/wrapped/:token/view
 * Track view for analytics (optional)
 */
router.post('/:token/view', asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Verify token
  const verification = await AccessTokenModel.verifyToken(token);
  if (!verification.valid) {
    return res.status(403).json({
      error: 'Invalid or expired token',
    });
  }

  // Track access
  const ipAddress = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
  const userAgent = req.get('user-agent') || 'Unknown';
  await AccessTokenModel.trackAccess(token, ipAddress, userAgent);

  res.json({
    success: true,
    message: 'View tracked',
  });
}));

export default router;
