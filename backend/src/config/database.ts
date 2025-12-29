import pgPromise from 'pg-promise';
import logger from '../utils/logger';

// PostgreSQL configuration
const pgp = pgPromise({
  // Initialization options
  error(err, e) {
    if (e.cn) {
      // Connection error
      logger.error('Database connection error:', {
        error: err.message,
        context: e.cn,
      });
    }
  },
  query(e) {
    // Log queries in debug mode
    if (process.env.DEBUG_MODE === 'true') {
      logger.debug('Database query:', {
        query: e.query,
        params: e.params,
      });
    }
  },
});

const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'plexunwrapped',
  user: process.env.POSTGRES_USER || 'plexunwrapped',
  password: process.env.POSTGRES_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Create database instance
const db = pgp(config);

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    await db.connect();
    logger.info('Database connection established successfully');
    return true;
  } catch (error: any) {
    logger.error('Failed to connect to database:', {
      error: error.message,
      host: config.host,
      port: config.port,
      database: config.database,
    });
    return false;
  }
}

// Health check
export async function healthCheck(): Promise<boolean> {
  try {
    await db.one('SELECT 1 as health');
    return true;
  } catch (error) {
    return false;
  }
}

// Get database info
export async function getDatabaseInfo() {
  try {
    const version = await db.one('SELECT version()');
    const size = await db.one(
      'SELECT pg_size_pretty(pg_database_size($1)) as size',
      [config.database]
    );
    return {
      version: version.version,
      size: size.size,
      config: {
        host: config.host,
        port: config.port,
        database: config.database,
        maxConnections: config.max,
      },
    };
  } catch (error: any) {
    logger.error('Failed to get database info:', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  try {
    await pgp.end();
    logger.info('Database connections closed');
  } catch (error: any) {
    logger.error('Error closing database connections:', error);
  }
}

export { db, pgp };
export default db;
