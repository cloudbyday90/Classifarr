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

// THIS FILE IS THE PUBLIC LOGGING API. Implementation lives in ./logging/.
// All 272 server modules import from this file — the exported names must stay stable.

export { sanitizeData } from './logging/sanitize.mjs';
export { getSystemContext } from './logging/requestContext.mjs';
export { resetDedupeState } from './logging/dedupe.mjs';

import { createRootLogger } from './logging/pinoFactory.mjs';
import { LoggerShim, setDb } from './logging/loggerShim.mjs';

// ---------------------------------------------------------------------------
// Root pino logger — created once per process.
// ---------------------------------------------------------------------------
const rootLogger = createRootLogger();

// ---------------------------------------------------------------------------
// Factory function — the primary API used by all 272 modules.
// ---------------------------------------------------------------------------

/**
 * Create a module-scoped logger.  The returned shim preserves the original
 * (message, data) call order so no call sites need to change.
 *
 * @param {string} moduleName - Identifier that appears in every log line.
 * @returns {LoggerShim}
 */
export function createLogger(moduleName) {
  return new LoggerShim(rootLogger.child({ module: moduleName }));
}

// ---------------------------------------------------------------------------
// DB registration — called once during app bootstrap.
// ---------------------------------------------------------------------------

/**
 * Register the database pool used for persisting error/warn entries.
 * Must be called before the first error() / warn() log you want persisted.
 *
 * @param {{ query: Function }} db
 */
export function setLoggerDb(db) {
  setDb(db);
}

// ---------------------------------------------------------------------------
// cleanupOldLogs — kept for compatibility with the scheduler.
// File rotation is now handled by pino-roll.
// ---------------------------------------------------------------------------

/**
 * Placeholder for scheduled log housekeeping.
 * File-level rotation is managed by pino-roll automatically.
 * DB-level log pruning can be added here in a future slice.
 *
 * @internal
 */
export function cleanupOldLogs() {
  // No-op: file rotation is delegated to pino-roll.
}

