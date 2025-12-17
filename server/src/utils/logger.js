/**
 * Simple logging utility
 */
class Logger {
  log(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, data || '');
    } else if (level === 'warn') {
      console.warn(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }
  }

  info(category, message, data = null) {
    this.log('info', category, message, data);
  }

  warn(category, message, data = null) {
    this.log('warn', category, message, data);
  }

  error(category, message, data = null) {
    this.log('error', category, message, data);
  }

  debug(category, message, data = null) {
    this.log('debug', category, message, data);
  }
}

module.exports = new Logger();
