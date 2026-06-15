/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ValidationError } from '../../utils/appError.mjs';
import { isMaskedToken } from '../../utils/tokenMasking.mjs';
import { normalizeWebSearchProviderKey } from '../../services/webSearchResultNormalizer.mjs';

const MAX_LIMIT = 1_000_000;
const MAX_DOMAINS = 25;
const MAX_DOMAIN_LENGTH = 253;
const SAFE_SHORT_CODE = /^[a-zA-Z0-9_-]{1,24}$/;
const SAFE_PROJECT_ID = /^[a-zA-Z0-9_.:-]{1,120}$/;
const SEARCH_DEPTHS = new Set(['basic', 'advanced']);

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return fallback;
  return ['true', 't', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toNullableInteger(value, { min = 1, max = MAX_LIMIT } = {}) {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function toDomainList(value) {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => item.length > 0 && item.length <= MAX_DOMAIN_LENGTH)
    .filter((item) => !item.includes('/') && !item.includes('\\'))
    .slice(0, MAX_DOMAINS);

  return [...new Set(normalized)];
}

function resolveApiKey(body = {}) {
  const submitted = body.apiKey ?? body.api_key;
  if (submitted == null || isMaskedToken(submitted)) return null;
  const trimmed = String(submitted).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSearchDepth(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return SEARCH_DEPTHS.has(normalized) ? normalized : undefined;
}

function normalizeProviderConfig(providerKey, config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
  const normalized = {};

  if (providerKey === 'tavily') {
    const searchDepth = normalizeSearchDepth(config.searchDepth ?? config.search_depth);
    if (searchDepth) normalized.searchDepth = searchDepth;

    const maxResults = toNullableInteger(config.maxResults ?? config.max_results, { min: 1, max: 20 });
    if (maxResults != null) normalized.maxResults = maxResults;

    const includeDomains = toDomainList(config.includeDomains ?? config.include_domains);
    if (includeDomains) normalized.includeDomains = includeDomains;

    const excludeDomains = toDomainList(config.excludeDomains ?? config.exclude_domains);
    if (excludeDomains) normalized.excludeDomains = excludeDomains;

    const projectId = String(config.projectId ?? config.project_id ?? '').trim();
    if (projectId && SAFE_PROJECT_ID.test(projectId)) normalized.projectId = projectId;
  }

  if (providerKey === 'brave') {
    const country = String(config.country || '').trim();
    if (country && SAFE_SHORT_CODE.test(country)) normalized.country = country.toUpperCase();
    if (config.safeSearch != null) normalized.safeSearch = toBoolean(config.safeSearch);
  }

  if (providerKey === 'serper') {
    const gl = String(config.gl || '').trim();
    if (gl && SAFE_SHORT_CODE.test(gl)) normalized.gl = gl.toLowerCase();
    const hl = String(config.hl || '').trim();
    if (hl && SAFE_SHORT_CODE.test(hl)) normalized.hl = hl.toLowerCase();
  }

  return normalized;
}

export function buildWebSearchProviderMutationPayload(body = {}, metadata = {}) {
  const providerKey = normalizeWebSearchProviderKey(
    body.providerKey ?? body.provider_key ?? metadata.providerKey
  );
  if (providerKey === 'unknown') {
    throw new ValidationError('Invalid web search provider key', { code: 'invalid_provider_key' });
  }

  const clearApiKey = toBoolean(body.clearApiKey ?? body.clear_api_key);

  return {
    providerKey,
    displayName: metadata.displayName || body.displayName || body.display_name || providerKey,
    isEnabled: toBoolean(body.isEnabled ?? body.is_enabled),
    priority: toNullableInteger(body.priority, { min: 1, max: 1000 }) ?? metadata.priority ?? 100,
    apiKey: clearApiKey ? null : resolveApiKey(body),
    clearApiKey,
    config: normalizeProviderConfig(providerKey, body.config),
    softDailyLimit: toNullableInteger(body.softDailyLimit ?? body.soft_daily_limit),
    softMonthlyLimit: toNullableInteger(body.softMonthlyLimit ?? body.soft_monthly_limit),
    cooldownUntil: body.cooldownUntil ?? body.cooldown_until ?? null,
  };
}

export function buildLegacyTavilyConfigFromProvider(providerConfig = {}) {
  const config = providerConfig.config || {};
  return {
    apiKey: providerConfig.apiKey || null,
    searchDepth: config.searchDepth || 'advanced',
    maxResults: toNullableInteger(config.maxResults, { min: 1, max: 20 }) || 5,
    includeDomains: toDomainList(config.includeDomains) || ['imdb.com', 'rottentomatoes.com', 'myanimelist.net', 'letterboxd.com'],
    excludeDomains: toDomainList(config.excludeDomains) || [],
    isActive: Boolean(providerConfig.isEnabled),
  };
}
