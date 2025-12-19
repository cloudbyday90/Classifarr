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

  error(message, data) { if (this.level >= LOG_LEVELS.ERROR) console.error(this.formatMessage('ERROR', message, data)); }
  warn(message, data) { if (this.level >= LOG_LEVELS.WARN) console.warn(this.formatMessage('WARN', message, data)); }
  info(message, data) { if (this.level >= LOG_LEVELS.INFO) console.log(this.formatMessage('INFO', message, data)); }
  debug(message, data) { if (this.level >= LOG_LEVELS.DEBUG) console.log(this.formatMessage('DEBUG', message, data)); }
}

const createLogger = (module) => new Logger(module);
module.exports = { createLogger, Logger };
