import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger';
import { getCacheService } from '../config/redis';
import type {
  TautulliApiResponse,
  TautulliUser,
  TautulliUsersTable,
  TautulliHistory,
  TautulliHistoryQuery,
  TautulliUserWatchTimeStats,
  TautulliMetadata,
  TautulliServerInfo,
  TautulliActivity,
} from '../types/tautulli.types';

export class TautulliService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;
  private cache: ReturnType<typeof getCacheService>;
  private cacheTTL: number;

  constructor() {
    this.baseUrl = process.env.TAUTULLI_URL || '';
    this.apiKey = process.env.TAUTULLI_API_KEY || '';
    this.cacheTTL = parseInt(process.env.TAUTULLI_CACHE_TTL || '3600', 10);

    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Tautulli URL and API key are required');
    }

    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v2`,
      timeout: parseInt(process.env.TAUTULLI_TIMEOUT || '30000', 10),
      params: {
        apikey: this.apiKey,
      },
    });

    this.cache = getCacheService();

    // Add request/response interceptors for logging
    this.client.interceptors.request.use((config) => {
      logger.logServiceCall('Tautulli', config.method?.toUpperCase() || 'GET', config.url || '');
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.logServiceError('Tautulli', 'API call', error);
        throw error;
      }
    );
  }

  /**
   * Make a generic API call to Tautulli
   */
  private async call<T>(
    cmd: string,
    params: Record<string, any> = {},
    useCache = true
  ): Promise<T> {
    const cacheKey = `tautulli:${cmd}:${JSON.stringify(params)}`;

    // Try cache first
    if (useCache) {
      const cached = await this.cache.get<T>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for Tautulli command: ${cmd}`);
        return cached;
      }
    }

    try {
      const response = await this.client.get<TautulliApiResponse<T>>('', {
        params: {
          cmd,
          ...params,
        },
      });

      if (response.data.response.result !== 'success') {
        throw new Error(response.data.response.message || 'Tautulli API call failed');
      }

      const data = response.data.response.data;

      // Cache successful response
      if (useCache) {
        await this.cache.set(cacheKey, data, this.cacheTTL);
      }

      return data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Tautulli API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Test connection to Tautulli
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.call('get_server_info', {}, false);
      logger.info('Tautulli connection test successful');
      return true;
    } catch (error: any) {
      logger.error('Tautulli connection test failed:', error);
      return false;
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<TautulliServerInfo> {
    return this.call<TautulliServerInfo>('get_server_info');
  }

  /**
   * Get all users
   */
  async getUsers(): Promise<TautulliUser[]> {
    const result = await this.call<TautulliUsersTable>('get_users_table', {
      length: 1000,
      order_column: 'friendly_name',
      order_dir: 'asc',
    });
    return result.data || [];
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<TautulliUser | null> {
    const users = await this.getUsers();
    return users.find((u) => u.user_id === userId) || null;
  }

  /**
   * Get history for a user
   */
  async getUserHistory(userId: number, query: Partial<TautulliHistoryQuery> = {}): Promise<TautulliHistory> {
    return this.call<TautulliHistory>('get_history', {
      user_id: userId,
      length: query.length || parseInt(process.env.TAUTULLI_PAGE_SIZE || '1000', 10),
      start: query.start || 0,
      order_column: query.order_column || 'date',
      order_dir: query.order_dir || 'desc',
      ...query,
    });
  }

  /**
   * Get history for a specific date range
   */
  async getUserHistoryByDateRange(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<TautulliHistory> {
    return this.getUserHistory(userId, {
      start_date: startDate,
      end_date: endDate,
      length: 10000, // Large enough to get all records for a year
    });
  }

  /**
   * Get user watch time stats
   */
  async getUserWatchTimeStats(userId: number, queryDays: number = 365): Promise<TautulliUserWatchTimeStats> {
    return this.call<TautulliUserWatchTimeStats>('get_user_watch_time_stats', {
      user_id: userId,
      query_days: queryDays,
      grouping: 0, // No grouping
    });
  }

  /**
   * Get metadata for a specific item
   */
  async getMetadata(ratingKey: number): Promise<TautulliMetadata> {
    return this.call<TautulliMetadata>('get_metadata', {
      rating_key: ratingKey,
    });
  }

  /**
   * Get metadata for multiple items
   */
  async getMetadataMultiple(ratingKeys: number[]): Promise<TautulliMetadata[]> {
    const promises = ratingKeys.map((key) => this.getMetadata(key));
    return Promise.all(promises);
  }

  /**
   * Get current activity
   */
  async getActivity(): Promise<TautulliActivity> {
    return this.call<TautulliActivity>('get_activity', {}, false); // Don't cache live data
  }

  /**
   * Get library stats
   */
  async getLibraries(): Promise<any[]> {
    return this.call<any[]>('get_libraries');
  }

  /**
   * Get home stats (popular content)
   */
  async getHomeStats(timeRange: number = 30, statsType: string = 'plays', statsCount: number = 10): Promise<any> {
    return this.call<any>('get_home_stats', {
      time_range: timeRange,
      stats_type: statsType,
      stats_count: statsCount,
    });
  }

  /**
   * Get all history for a year (paginated)
   * Note: Tautulli's date filtering doesn't work properly, so we fetch all data and filter in code
   */
  async getAllHistoryForYear(userId: number, year: number): Promise<TautulliHistory['data']> {
    // Calculate year boundaries as timestamps
    const startTimestamp = Math.floor(new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${year}-12-31T23:59:59Z`).getTime() / 1000);
    const pageSize = 1000;
    let allData: TautulliHistory['data'] = [];
    let start = 0;
    let hasMore = true;

    logger.info(`Fetching all history for user ${userId} for year ${year} (timestamps ${startTimestamp}-${endTimestamp})`);

    while (hasMore) {
      // Fetch without date filtering since Tautulli's API date filtering is broken
      const result = await this.getUserHistory(userId, {
        start,
        length: pageSize,
      });

      // Filter results by year in code
      const yearData = result.data.filter((record: any) => {
        const recordTimestamp = parseInt(record.date);
        return recordTimestamp >= startTimestamp && recordTimestamp <= endTimestamp;
      });

      allData = allData.concat(yearData);
      start += pageSize;

      // Check if we got all records for this user
      hasMore = result.data.length === pageSize && start < result.recordsFiltered;

      logger.debug(`Fetched page with ${result.data.length} records, ${yearData.length} match year ${year}, total so far: ${allData.length}`);
    }

    logger.info(`Fetched total of ${allData.length} history records for user ${userId} for year ${year}`);
    return allData;
  }

  /**
   * Clear cache for specific command or all
   */
  async clearCache(cmd?: string): Promise<number> {
    if (cmd) {
      return this.cache.delPattern(`tautulli:${cmd}:*`);
    }
    return this.cache.delPattern('tautulli:*');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const serverInfo = await this.getServerInfo();
      return {
        healthy: true,
        message: `Connected to ${serverInfo.pms_name} v${serverInfo.pms_version}`,
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
let tautulliServiceInstance: TautulliService | null = null;

export function getTautulliService(): TautulliService {
  if (!tautulliServiceInstance) {
    tautulliServiceInstance = new TautulliService();
  }
  return tautulliServiceInstance;
}

export default getTautulliService;
