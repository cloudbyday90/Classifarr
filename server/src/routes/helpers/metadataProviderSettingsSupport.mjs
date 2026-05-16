/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { resolveProviderApiKey } from './providerConfigHelpers.mjs';
/** @typedef {import('./settingsErrorSupport.mjs').SettingsRouteError} SettingsRouteError */
/** @typedef {import('./settingsRouteContracts.mjs').SettingsResponse} SettingsResponse */

/**
 * @typedef {{
 *   api_key?: string | null,
 *   language?: string | null,
 *   search_depth?: string | null,
 *   max_results?: number | string | null,
 *   include_domains?: string[] | null,
 *   exclude_domains?: string[] | null,
 *   is_active?: boolean | null,
 *   daily_limit?: number | string | null,
 *   requests_today?: number | null,
 *   last_reset_date?: string | null,
 * }} MetadataProviderConfig
 */

/**
 * @typedef {{
 *   api_key?: string | null,
 *   language?: string | null,
 *   search_depth?: string | null,
 *   max_results?: number | string | null,
 *   include_domains?: string[] | null,
 *   exclude_domains?: string[] | null,
 *   is_active?: boolean | null,
 *   daily_limit?: number | string | null,
 * }} MetadataProviderMutationBody
 */

/**
 * @typedef {{
 *   search_depth?: string | null,
 *   max_results?: number | null,
 *   include_domains?: string[] | null,
 *   exclude_domains?: string[] | null,
 * }} TavilySearchConfig
 */

/**
 * @param {unknown} value
 * @param {number | string} fallback
 * @returns {number}
 */
function parsePositiveInteger(value, fallback) {
  const parsedFallback = Number.parseInt(String(fallback), 10);
  const normalizedFallback = Number.isFinite(parsedFallback) && parsedFallback > 0 ? parsedFallback : 0;

  if (value === undefined) {
    return normalizedFallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : normalizedFallback;
}

export function buildMissingMetadataProviderApiKeyResponse() {
  return {
    status: 400,
    body: { error: 'API key is required' },
  };
}

export function buildInvalidTavilySearchRequestResponse() {
  return {
    status: 400,
    body: { error: 'API key and query are required' },
  };
}

export function buildMissingOmdbConfigurationResponse() {
  return {
    status: 400,
    body: { error: 'OMDb not configured' },
  };
}

/**
 * @param {MetadataProviderMutationBody} body
 * @param {MetadataProviderConfig | null | undefined} [existingConfig]
 */
export function buildTmdbConfigMutationPayload(body = {}, existingConfig) {
  const { api_key, language } = body;

  return {
    apiKey: resolveProviderApiKey(api_key, existingConfig?.api_key),
    language: language ?? existingConfig?.language ?? 'en-US',
  };
}

/**
 * @param {MetadataProviderMutationBody} body
 * @param {MetadataProviderConfig | null | undefined} [existingConfig]
 */
export function buildTavilyConfigMutationPayload(body = {}, existingConfig) {
  const {
    api_key,
    search_depth,
    max_results,
    include_domains,
    exclude_domains,
    is_active,
  } = body;

  return {
    apiKey: resolveProviderApiKey(api_key, existingConfig?.api_key),
    searchDepth: search_depth ?? existingConfig?.search_depth ?? 'advanced',
    maxResults: parsePositiveInteger(max_results, existingConfig?.max_results ?? 5),
    includeDomains: include_domains !== undefined ? include_domains : (existingConfig?.include_domains ?? ['imdb.com', 'rottentomatoes.com']),
    excludeDomains: exclude_domains !== undefined ? exclude_domains : (existingConfig?.exclude_domains ?? []),
    isActive: is_active ?? existingConfig?.is_active ?? true,
  };
}

/**
 * @param {string} apiKey
 * @param {TavilySearchConfig} [config={}]
 */
export function buildTavilySearchOptions(apiKey, config = {}) {
  return {
    apiKey,
    searchDepth: config.search_depth || 'advanced',
    maxResults: config.max_results || 5,
    includeDomains: config.include_domains || ['imdb.com', 'rottentomatoes.com'],
    excludeDomains: config.exclude_domains || [],
  };
}

/**
 * @param {MetadataProviderMutationBody} body
 * @param {MetadataProviderConfig | null | undefined} [existingConfig]
 */
export function buildOmdbConfigMutationPayload(body = {}, existingConfig) {
  const { api_key, is_active, daily_limit } = body;

  return {
    apiKey: resolveProviderApiKey(api_key, existingConfig?.api_key),
    isActive: is_active ?? existingConfig?.is_active ?? true,
    dailyLimit: parsePositiveInteger(daily_limit, existingConfig?.daily_limit || 1000),
    requestsToday: existingConfig?.requests_today || 0,
    lastResetDate: existingConfig?.last_reset_date || null,
  };
}
