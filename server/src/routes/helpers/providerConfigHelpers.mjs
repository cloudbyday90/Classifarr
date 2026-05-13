/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isMaskedToken, maskToken } from '../../utils/tokenMasking.mjs';

/**
 * @typedef {{
 *   query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, any>[] }>,
 * }} ProviderConfigQueryable
 */

/**
 * @typedef {{
 *   healthy: boolean,
 *   ssl_error?: boolean,
 *   api_reachable?: boolean | null,
 *   message: string,
 * }} ProviderHealthResult
 */

/**
 * @param {ProviderConfigQueryable} dbOrClient
 * @param {string} table
 * @param {{ activeOnly?: boolean }} [options]
 * @returns {Promise<Record<string, any> | null>}
 */
export async function fetchSingleProviderConfig(dbOrClient, table, { activeOnly = false } = {}) {
  const whereClause = activeOnly ? ' WHERE is_active = true' : '';
  const result = await dbOrClient.query(`SELECT * FROM ${table}${whereClause} LIMIT 1`);
  return result.rows[0] || null;
}

/**
 * @param {Record<string, any> | null | undefined} config
 * @returns {Record<string, any> | null}
 */
export function maskProviderApiKey(config) {
  if (!config) {
    return null;
  }

  const masked = { ...config };
  if (masked.api_key) {
    masked.api_key = maskToken(masked.api_key);
  }
  return masked;
}

export function resolveProviderApiKey(submittedApiKey, existingApiKey) {
  if (submittedApiKey === undefined || submittedApiKey === null || isMaskedToken(submittedApiKey)) {
    return existingApiKey || null;
  }

  if (submittedApiKey === '') {
    return '';
  }

  if (!isMaskedToken(submittedApiKey)) {
    return submittedApiKey;
  }

  return existingApiKey || null;
}

/**
 * @param {{
 *   dbOrClient: ProviderConfigQueryable,
 *   table: string,
 *   submittedApiKey?: string | null,
 *   activeOnly?: boolean,
 *   allowStoredFallback?: boolean,
 * }} options
 * @returns {Promise<string | null>}
 */
export async function resolveRequestApiKey({ dbOrClient, table, submittedApiKey, activeOnly = false, allowStoredFallback = false }) {
  if (submittedApiKey && !isMaskedToken(submittedApiKey)) {
    return submittedApiKey;
  }

  if (!submittedApiKey) {
    if (!allowStoredFallback) {
      return null;
    }

    const existing = await fetchSingleProviderConfig(dbOrClient, table, { activeOnly });
    return existing?.api_key || null;
  }

  if (!isMaskedToken(submittedApiKey)) {
    return submittedApiKey || null;
  }

  const existing = await fetchSingleProviderConfig(dbOrClient, table, { activeOnly });
  return existing?.api_key || null;
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [extra]
 */
export function buildUnavailableHealthResponse(message, extra = {}) {
  return {
    status: 'unavailable',
    configured: false,
    ssl_valid: null,
    api_reachable: null,
    message,
    ...extra,
  };
}

/**
 * @param {Error} error
 * @param {Record<string, unknown>} [extra]
 */
export function buildErrorHealthResponse(error, extra = {}) {
  return {
    status: 'unavailable',
    configured: null,
    ssl_valid: null,
    api_reachable: false,
    message: error.message,
    ...extra,
  };
}

/**
 * @param {ProviderHealthResult} healthResult
 * @param {Record<string, unknown>} [extra]
 */
export function buildHealthyProviderResponse(healthResult, extra = {}) {
  return {
    status: healthResult.healthy ? 'healthy' : (healthResult.ssl_error ? 'degraded' : 'unavailable'),
    configured: true,
    ssl_valid: !healthResult.ssl_error,
    api_reachable: healthResult.api_reachable,
    message: healthResult.message,
    ...extra,
  };
}
