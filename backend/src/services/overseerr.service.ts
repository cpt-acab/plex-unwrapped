import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger';
import { getCacheService } from '../config/redis';
import {
  MediaType,
  MediaRequestStatus,
  MediaStatus,
} from '../types/overseerr.types';
import type {
  OverseerrPaginatedResponse,
  OverseerrUser,
  OverseerrRequest,
  OverseerrRequestQuery,
  OverseerrStats,
  OverseerrStatus,
  OverseerrUserRequestStats,
} from '../types/overseerr.types';

export class OverseerrService {
  private client: AxiosInstance | null = null;
  private apiKey: string;
  private baseUrl: string;
  private cache: ReturnType<typeof getCacheService>;
  private cacheTTL: number;
  private enabled: boolean;

  constructor() {
    this.baseUrl = process.env.OVERSEERR_URL || '';
    this.apiKey = process.env.OVERSEERR_API_KEY || '';
    this.cacheTTL = parseInt(process.env.OVERSEERR_CACHE_TTL || '3600', 10);
    this.enabled = process.env.ENABLE_OVERSEERR === 'true' && !!this.baseUrl && !!this.apiKey;

    if (this.enabled) {
      this.client = axios.create({
        baseURL: `${this.baseUrl}/api/v1`,
        timeout: parseInt(process.env.OVERSEERR_TIMEOUT || '30000', 10),
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      // Add request/response interceptors for logging
      this.client.interceptors.request.use((config) => {
        logger.logServiceCall('Overseerr', config.method?.toUpperCase() || 'GET', config.url || '');
        return config;
      });

      this.client.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
          logger.logServiceError('Overseerr', 'API call', error);
          throw error;
        }
      );
    } else {
      logger.info('Overseerr integration is disabled');
    }

    this.cache = getCacheService();
  }

  /**
   * Check if Overseerr is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * Test connection to Overseerr
   */
  async testConnection(): Promise<boolean> {
    if (!this.isEnabled()) {
      logger.info('Overseerr is disabled, skipping connection test');
      return false;
    }

    try {
      await this.getStatus();
      logger.info('Overseerr connection test successful');
      return true;
    } catch (error: any) {
      logger.error('Overseerr connection test failed:', error);
      return false;
    }
  }

  /**
   * Get Overseerr status
   */
  async getStatus(): Promise<OverseerrStatus> {
    if (!this.client) throw new Error('Overseerr client not initialized');

    const cacheKey = 'overseerr:status';
    const cached = await this.cache.get<OverseerrStatus>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<OverseerrStatus>('/status');
    await this.cache.set(cacheKey, response.data, this.cacheTTL);
    return response.data;
  }

  /**
   * Get all users
   */
  async getUsers(): Promise<OverseerrUser[]> {
    if (!this.client) throw new Error('Overseerr client not initialized');

    const cacheKey = 'overseerr:users';
    const cached = await this.cache.get<OverseerrUser[]>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<OverseerrPaginatedResponse<OverseerrUser>>('/user', {
      params: {
        take: 1000,
        skip: 0,
      },
    });

    const users = response.data.results;
    await this.cache.set(cacheKey, users, this.cacheTTL);
    return users;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<OverseerrUser | null> {
    if (!this.client) throw new Error('Overseerr client not initialized');

    try {
      const response = await this.client.get<OverseerrUser>(`/user/${userId}`);
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user by Plex ID
   */
  async getUserByPlexId(plexId: number): Promise<OverseerrUser | null> {
    const users = await this.getUsers();
    // Match by plexUsername or other identifier
    return users.find((u) => u.plexUsername && u.id === plexId) || null;
  }

  /**
   * Get all requests
   */
  async getRequests(query: OverseerrRequestQuery = {}): Promise<OverseerrRequest[]> {
    if (!this.client) throw new Error('Overseerr client not initialized');

    const params = {
      take: query.take || 1000,
      skip: query.skip || 0,
      filter: query.filter || 'all',
      sort: query.sort || 'added',
      requestedBy: query.requestedBy,
    };

    const response = await this.client.get<OverseerrPaginatedResponse<OverseerrRequest>>('/request', {
      params,
    });

    return response.data.results;
  }

  /**
   * Get requests for a specific user
   */
  async getUserRequests(userId: number): Promise<OverseerrRequest[]> {
    const cacheKey = `overseerr:user:${userId}:requests`;
    const cached = await this.cache.get<OverseerrRequest[]>(cacheKey);
    if (cached) return cached;

    const requests = await this.getRequests({ requestedBy: userId });
    await this.cache.set(cacheKey, requests, this.cacheTTL);
    return requests;
  }

  /**
   * Get user requests for a specific year
   */
  async getUserRequestsForYear(userId: number, year: number): Promise<OverseerrRequest[]> {
    const allRequests = await this.getUserRequests(userId);

    const startDate = new Date(`${year}-01-01T00:00:00Z`);
    const endDate = new Date(`${year}-12-31T23:59:59Z`);

    return allRequests.filter((req) => {
      const createdAt = new Date(req.createdAt);
      return createdAt >= startDate && createdAt <= endDate;
    });
  }

  /**
   * Get statistics for a user's requests
   */
  async getUserRequestStats(userId: number, year?: number): Promise<OverseerrUserRequestStats> {
    const requests = year
      ? await this.getUserRequestsForYear(userId, year)
      : await this.getUserRequests(userId);

    const stats: OverseerrUserRequestStats = {
      userId,
      totalRequests: requests.length,
      movieRequests: requests.filter((r) => r.type === MediaType.MOVIE).length,
      tvRequests: requests.filter((r) => r.type === MediaType.TV).length,
      approvedRequests: requests.filter((r) => r.status === MediaRequestStatus.APPROVED).length,
      pendingRequests: requests.filter((r) => r.status === MediaRequestStatus.PENDING).length,
      declinedRequests: requests.filter((r) => r.status === MediaRequestStatus.DECLINED).length,
      availableRequests: requests.filter((r) => r.media.status === MediaStatus.AVAILABLE).length,
    };

    // Calculate approval times
    const approvedWithTimes = requests
      .filter((r) => r.status === MediaRequestStatus.APPROVED)
      .map((r) => {
        const created = new Date(r.createdAt).getTime();
        const updated = new Date(r.updatedAt).getTime();
        return (updated - created) / (1000 * 60 * 60); // hours
      })
      .filter((time) => time > 0);

    if (approvedWithTimes.length > 0) {
      stats.averageApprovalTimeHours =
        approvedWithTimes.reduce((a, b) => a + b, 0) / approvedWithTimes.length;
      stats.fastestApprovalTimeHours = Math.min(...approvedWithTimes);
      stats.slowestApprovalTimeHours = Math.max(...approvedWithTimes);
    }

    // Requests by month (if year specified)
    if (year) {
      const byMonth: Record<string, number> = {};
      requests.forEach((req) => {
        const month = req.createdAt.substring(0, 7); // YYYY-MM
        byMonth[month] = (byMonth[month] || 0) + 1;
      });
      stats.requestsByMonth = Object.entries(byMonth).map(([month, count]) => ({ month, count }));
    }

    // Top genres (from movie/tv data)
    const genreCounts: Record<string, number> = {};
    requests.forEach((req) => {
      const genres = req.movie?.genres || req.tv?.genres || [];
      genres.forEach((g) => {
        genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
      });
    });
    stats.topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    // Top requests
    stats.topRequests = requests
      .slice(0, 10)
      .map((req) => ({
        title: req.title || req.movie?.title || req.tv?.name || 'Unknown',
        type: req.type,
        status: req.media.status,
        requestedAt: req.createdAt,
        tmdbId: req.media.tmdbId,
        posterPath: req.posterPath,
      }));

    return stats;
  }

  /**
   * Get overall Overseerr stats
   */
  async getStats(): Promise<OverseerrStats> {
    if (!this.client) throw new Error('Overseerr client not initialized');

    const cacheKey = 'overseerr:stats';
    const cached = await this.cache.get<OverseerrStats>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<OverseerrStats>('/request/count');
    await this.cache.set(cacheKey, response.data, this.cacheTTL);
    return response.data;
  }

  /**
   * Clear cache
   */
  async clearCache(userId?: number): Promise<number> {
    if (userId) {
      return this.cache.delPattern(`overseerr:user:${userId}:*`);
    }
    return this.cache.delPattern('overseerr:*');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.isEnabled()) {
      return {
        healthy: true,
        message: 'Overseerr integration is disabled',
      };
    }

    try {
      const status = await this.getStatus();
      return {
        healthy: true,
        message: `Connected to Overseerr v${status.version}`,
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: error.message,
      };
    }
  }
}

// Singleton instance
let overseerrServiceInstance: OverseerrService | null = null;

export function getOverseerrService(): OverseerrService {
  if (!overseerrServiceInstance) {
    overseerrServiceInstance = new OverseerrService();
  }
  return overseerrServiceInstance;
}

export default getOverseerrService;
