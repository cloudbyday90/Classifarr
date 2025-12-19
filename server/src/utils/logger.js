const crypto = require('crypto');
const db = require('../config/database');

// Generate UUID v4 using crypto module (compatible with tests)
const uuidv4 = () => {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16)
  );
};

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

class Logger {
  constructor(module) {
    this.module = module;
    this.level = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    let log = `[${timestamp}] [${level}] [${this.module}] ${message}`;
    if (data) log += ` ${JSON.stringify(data)}`;
    return log;
  }

  async error(message, data = {}, options = {}) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
      
      // Persist to database with unique error ID
      const errorId = uuidv4();
      try {
        await this.persistError('ERROR', message, data, options, errorId);
      } catch (dbError) {
        console.error('Failed to persist error log:', dbError.message);
      }
      return errorId;
    }
  }

  async warn(message, data = {}) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
      try {
        await this.persistLog('WARN', message, data);
      } catch (err) {
        // Silently fail for non-error logs to avoid cascading failures
      }
    }
  }

  info(message, data) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  debug(message, data) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  async persistError(level, message, data, options, errorId) {
    const { req, stack, metadata } = options;
    
    const requestContext = req ? {
      url: req.originalUrl || req.url,
      method: req.method,
      params: req.params,
      query: req.query,
      body: this.sanitizeBody(req.body),
      userId: req.user?.id,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get?.('User-Agent')
    } : null;

    const systemContext = {
      nodeVersion: process.version,
      appVersion: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      platform: process.platform,
      arch: process.arch
    };

    await db.query(
      `INSERT INTO error_log (error_id, level, module, message, stack_trace, request_context, system_context, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [errorId, level, this.module, message, stack || data?.stack, requestContext, systemContext, metadata || data]
    );
  }

  async persistLog(level, message, data) {
    try {
      await db.query(
        `INSERT INTO app_log (level, module, message, metadata) VALUES ($1, $2, $3, $4)`,
        [level, this.module, message, data || {}]
      );
    } catch (err) {
      // Silently fail for non-error logs
    }
  }

  sanitizeBody(body) {
    if (!body) return null;
    const sanitized = { ...body };
    // Remove sensitive fields
    const sensitiveFields = ['password', 'api_key', 'apiKey', 'token', 'secret', 'authorization'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) sanitized[field] = '[REDACTED]';
    });
    return sanitized;
  }
}

const createLogger = (module) => new Logger(module);
module.exports = { createLogger, Logger };
