import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logToConsole = process.env.LOG_TO_CONSOLE !== 'false';
const logFilePath = process.env.LOG_FILE_PATH || '/app/logs';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [];

// Console transport
if (logToConsole) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// File transports (only if log file path is set)
if (logFilePath) {
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(logFilePath, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );

  // Combined logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(logFilePath, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: logLevel,
  levels: winston.config.npm.levels,
  transports,
  exitOnError: false,
});

// Add request logging helper
logger.logRequest = function (req: any, statusCode: number, responseTime: number) {
  const message = `${req.method} ${req.originalUrl} ${statusCode} - ${responseTime}ms`;
  const meta = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    responseTime,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  if (statusCode >= 500) {
    this.error(message, meta);
  } else if (statusCode >= 400) {
    this.warn(message, meta);
  } else {
    this.http(message, meta);
  }
};

// Add service logging helpers
logger.logServiceCall = function (
  service: string,
  method: string,
  endpoint: string,
  duration?: number
) {
  const message = `[${service}] ${method} ${endpoint}${duration ? ` - ${duration}ms` : ''}`;
  this.debug(message);
};

logger.logServiceError = function (service: string, method: string, error: any) {
  const message = `[${service}] ${method} failed`;
  this.error(message, {
    error: error.message,
    stack: error.stack,
    response: error.response?.data,
  });
};

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV !== 'test') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logFilePath || '/tmp', 'exceptions.log'),
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logFilePath || '/tmp', 'rejections.log'),
    })
  );
}

// Extend Winston Logger interface
declare module 'winston' {
  interface Logger {
    logRequest(req: any, statusCode: number, responseTime: number): void;
    logServiceCall(service: string, method: string, endpoint: string, duration?: number): void;
    logServiceError(service: string, method: string, error: any): void;
  }
}

export default logger;
