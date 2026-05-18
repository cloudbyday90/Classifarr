/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('metadataProviderIntegrityService');

const DEFAULT_WARNING_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_STARTUP_SAMPLE_LIMIT = 5;
const OMDB_ALLOWED_DAILY_LIMIT_MIN = 1;
const TAVILY_ALLOWED_SEARCH_DEPTHS = new Set(['basic', 'advanced']);

function isBlank(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function buildRuntimeDedupeKey(provider, category, signature) {
  return [
    'metadata-provider-runtime',
    provider || 'unknown',
    category || 'general',
    signature || 'generic',
  ].join(':');
}

function sanitizeRuntimeSignature(value) {
  return String(value || 'generic')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .slice(0, 160);
}

function mapOmdbInvalidRow(row = {}) {
  const reasons = [];
  if (Boolean(row.is_active) && isBlank(row.api_key)) {
    reasons.push('missing_api_key');
  }
  if (Boolean(row.is_active) && (!Number.isInteger(Number(row.daily_limit)) || Number(row.daily_limit) < OMDB_ALLOWED_DAILY_LIMIT_MIN)) {
    reasons.push('invalid_daily_limit');
  }
  if (row.requests_today != null && Number(row.requests_today) < 0) {
    reasons.push('negative_requests_today');
  }
  if (row.requests_today != null && row.daily_limit != null && Number(row.daily_limit) >= OMDB_ALLOWED_DAILY_LIMIT_MIN && Number(row.requests_today) > Number(row.daily_limit)) {
    reasons.push('requests_today_exceeds_limit');
  }

  return {
    id: Number.parseInt(row.id, 10) || null,
    isActive: Boolean(row.is_active),
    dailyLimit: row.daily_limit ?? null,
    requestsToday: row.requests_today ?? null,
    reasons,
  };
}

function mapTavilyInvalidRow(row = {}) {
  const reasons = [];
  const normalizedDepth = String(row.search_depth || '').trim().toLowerCase();

  if (Boolean(row.is_active) && isBlank(row.api_key)) {
    reasons.push('missing_api_key');
  }
  if (Boolean(row.is_active) && !TAVILY_ALLOWED_SEARCH_DEPTHS.has(normalizedDepth)) {
    reasons.push('invalid_search_depth');
  }
  if (row.max_results != null && (!Number.isInteger(Number(row.max_results)) || Number(row.max_results) < 1)) {
    reasons.push('invalid_max_results');
  }

  return {
    id: Number.parseInt(row.id, 10) || null,
    isActive: Boolean(row.is_active),
    searchDepth: row.search_depth ?? null,
    maxResults: row.max_results ?? null,
    reasons,
  };
}

export class MetadataProviderIntegrityService {
  constructor(deps = {}) {
    this.db = deps.db || db;
    this.logger = deps.logger || logger;
    this.warningDedupeWindowMs = Number.isFinite(Number(deps.warningDedupeWindowMs))
      ? Number(deps.warningDedupeWindowMs)
      : DEFAULT_WARNING_DEDUPE_WINDOW_MS;
    this.startupSampleLimit = Number.isFinite(Number(deps.startupSampleLimit))
      ? Number(deps.startupSampleLimit)
      : DEFAULT_STARTUP_SAMPLE_LIMIT;
  }

  warnProviderRuntimeFailure({
    provider,
    category = 'general',
    message,
    metadata = {},
    dedupeSignature = 'generic',
    dedupeWindowMs = this.warningDedupeWindowMs,
  } = {}) {
    this.logger.warn(
      message,
      {
        provider: provider || null,
        category,
        ...metadata,
      },
      {
        dedupeKey: buildRuntimeDedupeKey(provider, category, sanitizeRuntimeSignature(dedupeSignature)),
        dedupeWindowMs,
      }
    );
  }

  async auditPersistedConfigs({ source = 'startup_preflight' } = {}) {
    const [omdbResult, tavilyResult] = await Promise.all([
      this.db.query('SELECT id, is_active, api_key, daily_limit, requests_today FROM omdb_config ORDER BY id'),
      this.db.query('SELECT id, is_active, api_key, search_depth, max_results FROM tavily_config ORDER BY id'),
    ]);

    const omdbRows = Array.isArray(omdbResult.rows) ? omdbResult.rows : [];
    const tavilyRows = Array.isArray(tavilyResult.rows) ? tavilyResult.rows : [];

    const omdbActiveRows = omdbRows.filter((row) => Boolean(row.is_active));
    const tavilyActiveRows = tavilyRows.filter((row) => Boolean(row.is_active));

    const omdbInvalid = omdbRows
      .map(mapOmdbInvalidRow)
      .filter((row) => row.reasons.length > 0);
    const tavilyInvalid = tavilyRows
      .map(mapTavilyInvalidRow)
      .filter((row) => row.reasons.length > 0);

    if (omdbActiveRows.length > 1) {
      omdbInvalid.unshift({
        id: null,
        isActive: true,
        dailyLimit: null,
        requestsToday: null,
        reasons: ['multiple_active_rows'],
      });
    }

    if (tavilyActiveRows.length > 1) {
      tavilyInvalid.unshift({
        id: null,
        isActive: true,
        searchDepth: null,
        maxResults: null,
        reasons: ['multiple_active_rows'],
      });
    }

    const providers = [
      {
        provider: 'omdb',
        invalidCount: omdbInvalid.length,
        sample: omdbInvalid.slice(0, this.startupSampleLimit),
      },
      {
        provider: 'tavily',
        invalidCount: tavilyInvalid.length,
        sample: tavilyInvalid.slice(0, this.startupSampleLimit),
      },
    ].filter((entry) => entry.invalidCount > 0);

    if (providers.length > 0) {
      this.logger.warn(
        'Persisted metadata provider configuration drift detected; enrichment may warn once and fall back conservatively',
        {
          source,
          invalidProviderCount: providers.length,
          providers,
        },
        {
          dedupeKey: 'persisted-metadata-provider-config-drift',
          dedupeWindowMs: this.warningDedupeWindowMs,
        }
      );
    }

    return {
      invalidProviderCount: providers.length,
      providers,
    };
  }
}

export const metadataProviderIntegrityService = new MetadataProviderIntegrityService();
