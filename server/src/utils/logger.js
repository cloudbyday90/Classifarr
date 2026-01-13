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
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

// Log file configuration
const LOG_CONFIG = {
  maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5, // Keep 5 rotated files
  maxAge: parseInt(process.env.LOG_MAX_AGE_DAYS) || 7, // 7 days
  maxTotalSize: parseInt(process.env.LOG_MAX_TOTAL_SIZE) || 100 * 1024 * 1024, // 100MB
  compress: process.env.LOG_COMPRESS !== 'false', // Default true
  logDir: process.env.LOG_DIR || '/app/data/logs',
  enabled: process.env.FILE_LOGGING_ENABLED !== 'false' // Default true
};

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
    ip: req.ip || req.socket?.remoteAddress,
    userId: req.user?.id
  });
}

// File logging utilities
class FileLogger {
  constructor() {
    this.mainLogPath = path.join(LOG_CONFIG.logDir, 'classifarr.log');
    this.errorLogPath = path.join(LOG_CONFIG.logDir, 'error.log');
    this.initialized = false;
  }

  initialize() {
    if (!LOG_CONFIG.enabled || this.initialized) return;
    
    try {
      // Create log directory if it doesn't exist
      if (!fs.existsSync(LOG_CONFIG.logDir)) {
        fs.mkdirSync(LOG_CONFIG.logDir, { recursive: true });
      }
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize file logging:', err.message);
    }
  }

  shouldRotate(logPath) {
    try {
      if (!fs.existsSync(logPath)) return false;
      const stats = fs.statSync(logPath);
      return stats.size >= LOG_CONFIG.maxFileSize;
    } catch (err) {
      return false;
    }
  }

  rotateLog(logPath) {
    try {
      if (!fs.existsSync(logPath)) return;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = `${logPath}.${timestamp}`;
      
      // Rename current log file
      fs.renameSync(logPath, rotatedPath);

      // Compress rotated file if enabled
      if (LOG_CONFIG.compress) {
        const gzip = zlib.createGzip();
        const input = fs.createReadStream(rotatedPath);
        const output = fs.createWriteStream(`${rotatedPath}.gz`);
        
        input.pipe(gzip).pipe(output);
        
        output.on('finish', () => {
          // Delete uncompressed file after compression
          fs.unlinkSync(rotatedPath);
        });
      }

      // Clean up old rotated files
      this.cleanupRotatedFiles(logPath);
    } catch (err) {
      console.error('Failed to rotate log file:', err.message);
    }
  }

  cleanupRotatedFiles(logPath) {
    try {
      const logDir = path.dirname(logPath);
      const logBasename = path.basename(logPath);
      const files = fs.readdirSync(logDir);

      // Find all rotated files for this log
      const rotatedFiles = files
        .filter(f => f.startsWith(logBasename + '.'))
        .map(f => ({
          name: f,
          path: path.join(logDir, f),
          stats: fs.statSync(path.join(logDir, f))
        }))
        .sort((a, b) => b.stats.mtime - a.stats.mtime); // Sort by modification time, newest first

      // Remove files exceeding max count
      if (rotatedFiles.length > LOG_CONFIG.maxFiles) {
        rotatedFiles.slice(LOG_CONFIG.maxFiles).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (err) {
      console.error('Failed to cleanup rotated files:', err.message);
    }
  }

  writeLog(logPath, message) {
    if (!LOG_CONFIG.enabled || !this.initialized) return;

    try {
      // Check if rotation is needed
      if (this.shouldRotate(logPath)) {
        this.rotateLog(logPath);
      }

      // Append log message
      fs.appendFileSync(logPath, message + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write to log file:', err.message);
    }
  }

  writeMainLog(message) {
    this.writeLog(this.mainLogPath, message);
  }

  writeErrorLog(message) {
    this.writeLog(this.errorLogPath, message);
  }
}

// Singleton file logger instance
const fileLogger = new FileLogger();

// Cleanup old logs function
function cleanupOldLogs() {
  if (!LOG_CONFIG.enabled) return;

  try {
    if (!fs.existsSync(LOG_CONFIG.logDir)) return;

    const now = Date.now();
    const maxAge = LOG_CONFIG.maxAge * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const files = fs.readdirSync(LOG_CONFIG.logDir);
    
    let totalSize = 0;
    const fileStats = [];

    // Collect file stats
    files.forEach(file => {
      const filePath = path.join(LOG_CONFIG.logDir, file);
      const stats = fs.statSync(filePath);
      
      // Delete files older than maxAge
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old log file: ${file}`);
      } else {
        totalSize += stats.size;
        fileStats.push({ path: filePath, size: stats.size, mtime: stats.mtime });
      }
    });

    // If total size exceeds limit, delete oldest files
    if (totalSize > LOG_CONFIG.maxTotalSize) {
      fileStats.sort((a, b) => a.mtime - b.mtime); // Sort oldest first
      
      for (const file of fileStats) {
        if (totalSize <= LOG_CONFIG.maxTotalSize) break;
        
        fs.unlinkSync(file.path);
        totalSize -= file.size;
        console.log(`Deleted old log file to free space: ${path.basename(file.path)}`);
      }
    }

    console.log(`Log cleanup complete. Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.error('Failed to cleanup old logs:', err.message);
  }
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
      const formattedMsg = this.formatMessage('ERROR', message, data);
      console.error(formattedMsg);
      fileLogger.writeMainLog(formattedMsg);
      fileLogger.writeErrorLog(formattedMsg);
      const errorId = await this.persistToDb('ERROR', message, data, options);
      return errorId;
    }
    return null;
  }

  async warn(message, data, options = {}) {
    if (this.level >= LOG_LEVELS.WARN) {
      const formattedMsg = this.formatMessage('WARN', message, data);
      console.warn(formattedMsg);
      fileLogger.writeMainLog(formattedMsg);
      fileLogger.writeErrorLog(formattedMsg);
      const errorId = await this.persistToDb('WARN', message, data, options);
      return errorId;
    }
    return null;
  }

  info(message, data) {
    if (this.level >= LOG_LEVELS.INFO) {
      const formattedMsg = this.formatMessage('INFO', message, data);
      console.log(formattedMsg);
      fileLogger.writeMainLog(formattedMsg);
    }
  }

  debug(message, data) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      const formattedMsg = this.formatMessage('DEBUG', message, data);
      console.log(formattedMsg);
      fileLogger.writeMainLog(formattedMsg);
    }
  }
}

const createLogger = (module) => new Logger(module);

// Initialize file logging on module load (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  fileLogger.initialize();
}

module.exports = { 
  createLogger, 
  Logger, 
  sanitizeData, 
  getSystemContext, 
  getRequestContext,
  cleanupOldLogs,
  initializeFileLogging: () => fileLogger.initialize()
};
