/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const os = require('os');

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

// Sensitive fields to redact
const SENSITIVE_FIELDS = [
  'password', 'token', 'api_key', 'apikey', 'api-key',
  'secret', 'authorization', 'auth', 'jwt', 'session',
  'cookie', 'access_token', 'refresh_token', 'private_key'
];

// Sanitize sensitive data
function sanitizeData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }
  
  return sanitized;
}

// Capture system context
function getSystemContext() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: process.memoryUsage()
    },
    hostname: os.hostname()
  };
}

// Capture request context
function getRequestContext(req) {
  if (!req) return null;
  
  return sanitizeData({
    method: req.method,
    url: req.url,
    path: req.path,
    params: req.params,
    query: req.query,
    headers: {
      'user-agent': req.get('user-agent'),
      'content-type': req.get('content-type'),
      'origin': req.get('origin')
    },
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.user?.id
  });
}

class Logger {
  constructor(module) {
    this.module = module;
    this.level = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];
    this.db = null;
    
    // Lazy load database to avoid circular dependencies
    try {
      this.db = require('../config/database');
    } catch (err) {
      // Database not available yet (e.g., during initial setup)
    }
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    let log = `[${timestamp}] [${level}] [${this.module}] ${message}`;
    if (data) log += ` ${JSON.stringify(data)}`;
    return log;
  }

  async persistToDb(level, message, data, options = {}) {
    if (!this.db) return null;
    
    try {
      const sanitizedData = sanitizeData(data);
      const systemContext = getSystemContext();
      const requestContext = options.req ? getRequestContext(options.req) : null;
      
      const stack = options.error?.stack || new Error().stack;
      
      const result = await this.db.query(
        `INSERT INTO error_log (level, module, message, stack_trace, request_context, system_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING error_id`,
        [
          level,
          this.module,
          message,
          stack,
          requestContext,
          systemContext,
          sanitizedData
        ]
      );
      
      return result.rows[0].error_id;
    } catch (err) {
      // Don't fail if logging to DB fails
      console.error('Failed to persist log to database:', err.message);
      return null;
    }
  }

  async error(message, data, options = {}) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
      const errorId = await this.persistToDb('ERROR', message, data, options);
      return errorId;
    }
    return null;
  }

  async warn(message, data, options = {}) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
      const errorId = await this.persistToDb('WARN', message, data, options);
      return errorId;
    }
    return null;
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
}

const createLogger = (module) => new Logger(module);
module.exports = { createLogger, Logger, sanitizeData, getSystemContext, getRequestContext };
