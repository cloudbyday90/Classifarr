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

import { SENSITIVE_FIELD_PATHS } from './logConfig.mjs';

/**
 * Recursively redacts sensitive fields from a plain data object before it is
 * written to any output (file, console, or database). Arrays are traversed
 * element-by-element; non-object values are returned unchanged.
 *
 * A field name is considered sensitive if its lower-cased form contains any of
 * the entries in SENSITIVE_FIELD_PATHS. This is intentionally broad — a field
 * named `user_token` will be redacted because it contains "token".
 *
 * @param {unknown} data - The value to sanitize.
 * @returns {unknown} A new object/array with sensitive fields replaced by
 *   '[REDACTED]', or the original primitive value if `data` is not an object.
 */
export function sanitizeData(data) {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized = {};
  for (const key of Object.keys(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELD_PATHS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (data[key] !== null && typeof data[key] === 'object') {
      sanitized[key] = sanitizeData(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}

/**
 * Safe JSON serialiser that handles circular references. Returns the
 * JSON string, or a fallback string describing the failure.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return String(value);
  }
}
