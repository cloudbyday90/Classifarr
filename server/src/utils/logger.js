/**
 * Simple logger utility for Classifarr
 * Provides consistent logging with timestamps and log levels
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const LOG_COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[90m', // Gray
  RESET: '\x1b[0m'
};

class Logger {
  constructor(module) {
    this.module = module;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
  }

  shouldLog(level) {
    const levels = Object.keys(LOG_LEVELS);
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex <= currentLevelIndex;
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const color = LOG_COLORS[level];
    const reset = LOG_COLORS.RESET;
    
    let logMessage = `${color}[${timestamp}] [${level}] [${this.module}]${reset} ${message}`;
    
    if (data) {
      if (data instanceof Error) {
        logMessage += `\n${color}Error: ${data.message}${reset}`;
        if (data.stack && this.logLevel === 'DEBUG') {
          logMessage += `\n${data.stack}`;
        }
      } else if (typeof data === 'object') {
        logMessage += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        logMessage += ` ${data}`;
      }
    }
    
    return logMessage;
  }

  error(message, data = null) {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message, data = null) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }
}

/**
 * Create a logger instance for a module
 * @param {string} module - Name of the module (e.g., 'ClassificationService', 'RadarrService')
 * @returns {Logger}
 */
function createLogger(module) {
  return new Logger(module);
}

module.exports = { createLogger, Logger };
