/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import { validateWebSearchRequest } from './webSearchProviderContract.mjs';
import {
  normalizeWebSearchProviderKey,
  sanitizeWebSearchText,
  truncateWebSearchText,
} from './webSearchResultNormalizer.mjs';

export const DEFAULT_WEB_SEARCH_PROVIDER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_WEB_SEARCH_PROVIDER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CACHE_IDENTITY_VERSION = 1;
const SECRET_OR_TRANSPORT_KEYS = new Set([
  'apikey',
  'api_key',
  'authorization',
  'bearer',
  'password',
  'projectid',
  'project_id',
  'secret',
  'timeout',
  'token',
  'xapikey',
  'x-api-key',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeConfigKey(key) {
  return String(key || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

function isSecretOrTransportKey(key) {
  return SECRET_OR_TRANSPORT_KEYS.has(normalizeConfigKey(key));
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .filter((key) => value[key] !== undefined && !isSecretOrTransportKey(key))
    .sort()
    .reduce((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function normalizeWebSearchProviderCacheTtlMs(value, {
  fallback = DEFAULT_WEB_SEARCH_PROVIDER_CACHE_TTL_MS,
  max = MAX_WEB_SEARCH_PROVIDER_CACHE_TTL_MS,
} = {}) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export function normalizeWebSearchProviderCacheConfig(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {};
  }
  return stableValue(config);
}

export function normalizeWebSearchProviderCacheQuery(query) {
  return sanitizeWebSearchText(query)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildWebSearchProviderCacheIdentity({ providerKey, request, config = {} } = {}) {
  const normalizedProviderKey = normalizeWebSearchProviderKey(providerKey);
  if (normalizedProviderKey === 'unknown') {
    throw new Error('Invalid web search provider cache key provider');
  }

  const validatedRequest = validateWebSearchRequest(request);
  const normalizedQuery = normalizeWebSearchProviderCacheQuery(validatedRequest.query);
  const payload = {
    version: CACHE_IDENTITY_VERSION,
    providerKey: normalizedProviderKey,
    purpose: validatedRequest.purpose,
    query: normalizedQuery,
    media: stableValue(validatedRequest.media || {}),
    options: stableValue(validatedRequest.options || {}),
    config: normalizeWebSearchProviderCacheConfig(config),
  };
  const serializedPayload = stableStringify(payload);

  return Object.freeze({
    cacheKey: sha256(serializedPayload),
    providerKey: normalizedProviderKey,
    purpose: validatedRequest.purpose,
    queryHash: sha256(normalizedQuery),
    requestFingerprint: sha256(serializedPayload),
    queryPreview: truncateWebSearchText(validatedRequest.query, 160),
    identityPayload: Object.freeze(payload),
    request: validatedRequest,
  });
}
