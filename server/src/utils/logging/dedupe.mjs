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
 * Log deduplication / throttle helpers.
 *
 * A module-level cache is used so that dedup state is shared across all
 * LoggerShim instances, matching the previous static class behaviour.
 * The cache is keyed by a fingerprint of (module, level, dedupeKey, message).
 */

const LOG_DEDUPE_DEFAULT_WINDOW_MS = 60_000;
const LOG_DEDUPE_PRUNE_INTERVAL = 100;
const LOG_DEDUPE_CACHE_MAX_ENTRIES = 1_000;

/** @type {Map<string, number>} fingerprint → timestamp of first occurrence */
export const logDedupeCache = new Map();

/** Counter used to trigger periodic cache pruning. */
export let dedupeWriteCount = 0;

/** Reset the dedup state. Primarily used in tests. */
export function resetDedupeState() {
  logDedupeCache.clear();
  dedupeWriteCount = 0;
}

/**
 * Build a unique string fingerprint for deduplication.
 *
 * @param {string} moduleName
 * @param {string} level
 * @param {string} message
 * @param {{ dedupeKey?: string }} options
 * @returns {string | null} null when no dedupeKey is provided
 */
export function buildDedupeFingerprint(moduleName, level, message, options = {}) {
  const dedupeKey = typeof options?.dedupeKey === 'string' ? options.dedupeKey.trim() : '';
  if (!dedupeKey) return null;
  return [moduleName, level, dedupeKey, message].join('|');
}

/**
 * Prune entries that are older than `maxAge` ms from the dedup cache.
 *
 * @param {number} now - Current timestamp (ms).
 * @param {number} [maxAge] - Maximum age in ms before an entry is pruned.
 */
export function pruneDedupeCache(now = Date.now(), maxAge = LOG_DEDUPE_DEFAULT_WINDOW_MS * 4) {
  for (const [fingerprint, seenAt] of logDedupeCache.entries()) {
    if ((now - seenAt) > maxAge) {
      logDedupeCache.delete(fingerprint);
    }
  }
}

/**
 * Returns true when the given log entry should be suppressed because an
 * identical entry was already emitted within the dedup window.
 *
 * Side-effects: records the fingerprint timestamp and may prune the cache.
 *
 * @param {string} moduleName
 * @param {string} level
 * @param {string} message
 * @param {{ dedupeKey?: string, dedupeWindowMs?: number }} options
 * @returns {boolean}
 */
export function shouldThrottle(moduleName, level, message, options = {}) {
  const fingerprint = buildDedupeFingerprint(moduleName, level, message, options);
  if (!fingerprint) return false;

  const dedupeWindowMs =
    Number.isFinite(Number(options?.dedupeWindowMs)) && Number(options.dedupeWindowMs) > 0
      ? Number(options.dedupeWindowMs)
      : LOG_DEDUPE_DEFAULT_WINDOW_MS;

  const now = Date.now();
  const previous = logDedupeCache.get(fingerprint);
  if (previous !== undefined && (now - previous) < dedupeWindowMs) {
    return true;
  }

  logDedupeCache.set(fingerprint, now);

  dedupeWriteCount += 1;
  if (
    dedupeWriteCount % LOG_DEDUPE_PRUNE_INTERVAL === 0 ||
    logDedupeCache.size > LOG_DEDUPE_CACHE_MAX_ENTRIES
  ) {
    pruneDedupeCache(now, Math.max(LOG_DEDUPE_DEFAULT_WINDOW_MS * 4, dedupeWindowMs * 4));
  }

  return false;
}
