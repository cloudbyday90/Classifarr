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

import { sanitizeData } from './sanitize.mjs';
import { getSystemContext, getRequestContext, extractError } from './requestContext.mjs';
import { shouldThrottle } from './dedupe.mjs';

// ---------------------------------------------------------------------------
// Module-level DB reference
// ---------------------------------------------------------------------------

/** @type {{ query: Function } | null} */
let _db = null;

export function setDb(db) {
  _db = db;
}

// ---------------------------------------------------------------------------
// DB persistence
// ---------------------------------------------------------------------------

/**
 * Persist a log entry to the error_log table.
 *
 * Returns the generated error_id UUID, or null on failure (including when no
 * DB is registered). Never throws — callers must not depend on the return
 * value for control flow.
 *
 * @param {string} level - e.g. 'ERROR' | 'WARN'
 * @param {string} moduleName
 * @param {string} message
 * @param {object | null} data
 * @param {{ req?: object, error?: Error, skipDbPersist?: boolean, persistStack?: boolean }} options
 * @returns {Promise<string | null>}
 */
export async function persistToDb(level, moduleName, message, data, options = {}) {
  const db = _db;
  if (!db || typeof db.query !== 'function') return null;

  try {
    const upstreamError = extractError(data, options);
    const sanitizedData = sanitizeData(data);
    const systemContext = getSystemContext();
    const requestContext = options.req ? getRequestContext(options.req) : null;
    const stack = options.persistStack === false
      ? null
      : (upstreamError?.stack ?? (level === 'ERROR' ? new Error().stack : null));

    const result = await db.query(
      `INSERT INTO error_log (level, module, message, stack_trace, request_context, system_context, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING error_id`,
      [level, moduleName, message, stack, requestContext, systemContext, sanitizedData]
    );

    return result.rows[0].error_id;
  } catch (err) {
    // eslint-disable-next-line no-console -- fallback when DB persistence fails and logger is unavailable
    console.error('Failed to persist log to database:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// LoggerShim — pino-backed logger that preserves the existing public API
// ---------------------------------------------------------------------------

/**
 * Wraps a pino child logger to preserve the original `(message, data)` call
 * signature used across ~272 server modules. Pino's native order is
 * `(mergingObject, message)`, which would require 1,634 call-site edits.
 *
 * The shim reorders arguments so callers need no changes.
 */
export class LoggerShim {
  /**
   * @param {import('pino').Logger} pinoChild - A pino child bound with `{ module }`.
   */
  constructor(pinoChild) {
    this._pino = pinoChild;
    this.module = pinoChild.bindings().module;
  }

  // -------------------------------------------------------------------------
  // Public logging methods (matching existing Logger class API)
  // -------------------------------------------------------------------------

  /**
   * Log an error-level message and persist to DB.
   *
   * @param {string} message
   * @param {object | null} [data]
   * @param {{ req?: object, error?: Error, skipDbPersist?: boolean, persistStack?: boolean }} [options]
   * @returns {Promise<string | null>} errorId from DB, or null
   */
  async error(message, data, options = {}) {
    const sanitized = data ? sanitizeData(data) : undefined;
    this._pino.error(sanitized ?? {}, message);

    if (options?.skipDbPersist === true) return null;

    try {
      return await persistToDb('ERROR', this.module, message, data, options);
    } catch (_err) {
      return null;
    }
  }

  /**
   * Log a warn-level message and persist to DB (with deduplication).
   *
   * @param {string} message
   * @param {object | null} [data]
   * @param {{ req?: object, error?: Error, dedupeKey?: string, dedupeWindowMs?: number, skipDbPersist?: boolean }} [options]
   * @returns {Promise<string | null>} errorId from DB, or null
   */
  async warn(message, data, options = {}) {
    if (shouldThrottle(this.module, 'WARN', message, options)) return null;

    const sanitized = data ? sanitizeData(data) : undefined;
    this._pino.warn(sanitized ?? {}, message);

    if (options?.skipDbPersist === true) return null;

    try {
      return await persistToDb('WARN', this.module, message, data, options);
    } catch (_err) {
      return null;
    }
  }

  /**
   * Log an info-level message. Synchronous, no DB persist.
   *
   * @param {string} message
   * @param {object | null} [data]
   */
  info(message, data) {
    const sanitized = data ? sanitizeData(data) : undefined;
    this._pino.info(sanitized ?? {}, message);
  }

  /**
   * Log a debug-level message. Synchronous, no DB persist.
   *
   * @param {string} message
   * @param {object | null} [data]
   */
  debug(message, data) {
    const sanitized = data ? sanitizeData(data) : undefined;
    this._pino.debug(sanitized ?? {}, message);
  }
}
