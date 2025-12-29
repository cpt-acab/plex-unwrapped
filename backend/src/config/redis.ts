import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

// Redis configuration
const config = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
};

// Create Redis client
let client: RedisClientType | null = null;

export async function createRedisClient(): Promise<RedisClientType> {
  if (client) {
    return client;
  }

  const url = config.password
    ? `redis://:${config.password}@${config.host}:${config.port}/${config.db}`
    : `redis://${config.host}:${config.port}/${config.db}`;

  client = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis: Maximum reconnection attempts reached');
          return new Error('Maximum reconnection attempts reached');
        }
        const delay = Math.min(retries * 100, 3000);
        logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  });

  client.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('reconnecting', () => {
    logger.warn('Redis client reconnecting...');
  });

  client.on('end', () => {
    logger.info('Redis client disconnected');
  });

  await client.connect();
  return client;
}

// Get Redis client
export function getRedisClient(): RedisClientType {
  if (!client) {
    throw new Error('Redis client not initialized. Call createRedisClient first.');
  }
  return client;
}

// Cache helpers
export class CacheService {
  private client: RedisClientType;
  private defaultTTL: number;

  constructor(client: RedisClientType, defaultTTL = 3600) {
    this.client = client;
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error: any) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      await this.client.setEx(key, expiry, serialized);
      return true;
    } catch (error: any) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error: any) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      await this.client.del(keys);
      return keys.length;
    } catch (error: any) {
      logger.error(`Cache delete pattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error: any) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error: any) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  async flush(): Promise<boolean> {
    try {
      await this.client.flushDb();
      logger.info('Cache flushed successfully');
      return true;
    } catch (error: any) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  // Increment counter
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error: any) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  // Increment counter with expiry
  async incrWithExpiry(key: string, ttl: number): Promise<number> {
    try {
      const value = await this.client.incr(key);
      if (value === 1) {
        // First increment, set expiry
        await this.client.expire(key, ttl);
      }
      return value;
    } catch (error: any) {
      logger.error(`Cache incrWithExpiry error for key ${key}:`, error);
      return 0;
    }
  }
}

// Health check
export async function redisHealthCheck(): Promise<boolean> {
  try {
    if (!client) return false;
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (error) {
    return false;
  }
}

// Get Redis info
export async function getRedisInfo() {
  try {
    if (!client) throw new Error('Redis client not initialized');
    const info = await client.info();
    return {
      connected: client.isReady,
      config: {
        host: config.host,
        port: config.port,
        db: config.db,
      },
      info,
    };
  } catch (error: any) {
    logger.error('Failed to get Redis info:', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  try {
    if (client) {
      await client.quit();
      client = null;
      logger.info('Redis connection closed');
    }
  } catch (error: any) {
    logger.error('Error closing Redis connection:', error);
  }
}

// Export singleton cache service
let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    const client = getRedisClient();
    const defaultTTL = parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10);
    cacheServiceInstance = new CacheService(client, defaultTTL);
  }
  return cacheServiceInstance;
}

export { client };
