/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

/**
 * Centralised logging configuration resolved from environment variables.
 *
 * `LOG_CONFIG` is the immutable snapshot used by runtime callers. Tests and
 * other pure consumers can call `resolveLogConfig(...)` directly to evaluate
 * env-driven behavior without reloading the ESM module graph.
 */

export const VALID_LOG_LEVELS = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

/** Map from our internal uppercase convention to pino's lowercase convention. */
export const INTERNAL_TO_PINO_LEVEL = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
};

function resolveLogLevel(raw) {
  if (!raw) return 'info';
  const normalized = raw.trim().toLowerCase();
  return VALID_LOG_LEVELS.has(normalized) ? normalized : 'info';
}

function resolveInt(raw, defaultValue) {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function resolveLogConfig(environment = process.env) {
  return {
    /** Pino-compatible lowercase level string. */
    level: resolveLogLevel(environment.LOG_LEVEL),

    /** Maximum single log file size in bytes before rotation (default 10 MB). */
    maxFileSizeBytes: resolveInt(environment.LOG_MAX_FILE_SIZE, 10 * 1024 * 1024),

    /** Number of rotated log files to keep (default 5). */
    maxFiles: resolveInt(environment.LOG_MAX_FILES, 5),

    /** Maximum age of log files in days before deletion (default 7). */
    maxAgeDays: resolveInt(environment.LOG_MAX_AGE_DAYS, 7),

    /** Maximum total size of all log files in bytes (default 100 MB). */
    maxTotalSizeBytes: resolveInt(environment.LOG_MAX_TOTAL_SIZE, 100 * 1024 * 1024),

    /** Whether to gzip-compress rotated log files. */
    compress: environment.LOG_COMPRESS !== 'false',

    /** Directory for log files. */
    logDir: environment.LOG_DIR || '/app/data/logs',

    /** Whether file logging is enabled (can be disabled for test/CI environments). */
    fileLoggingEnabled: environment.FILE_LOGGING_ENABLED !== 'false',
  };
}

export const LOG_CONFIG = Object.freeze(resolveLogConfig());

export const SENSITIVE_FIELD_PATHS = Object.freeze([
  'password',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'secret',
  'authorization',
  'auth',
  'jwt',
  'session',
  'cookie',
  'access_token',
  'refresh_token',
  'private_key',
]);


