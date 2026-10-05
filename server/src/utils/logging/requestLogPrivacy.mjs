/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const REDACTED = '[REDACTED]';

/**
 * Project a request/referrer URL for logging only. Queries, fragments and
 * user-info are never retained, including unrecognized credential aliases.
 * Do not use this projection for routing, authentication or provider requests.
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function requestLogUrl(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f\\]/u.test(value)) return REDACTED;
  const relative = value.startsWith('/') && !value.startsWith('//');
  if (!relative && !/^https?:\/\//iu.test(value)) return REDACTED;
  try {
    const parsed = new URL(value, 'http://request-log.invalid');
    return relative ? parsed.pathname : `${parsed.origin}${parsed.pathname}`;
  } catch {
    // Never fall back to the raw value after parsing fails.
    return REDACTED;
  }
}

/**
 * Retain query field names for diagnosis, not their values. A denylist cannot
 * cover nested URLs, provider-specific aliases or rejected parser forms.
 * @param {unknown} query
 * @returns {Record<string, string> | undefined}
 */
export function requestLogQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return undefined;
  return Object.fromEntries(Object.keys(query).map((name) => [name, REDACTED]));
}
