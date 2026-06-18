/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import { maskToken } from '../utils/tokenMasking.mjs';
import { normalizeWebSearchProviderKey } from './webSearchResultNormalizer.mjs';

export const WEB_SEARCH_PROVIDER_STORAGE_DEFAULTS = Object.freeze([
  { providerKey: 'tavily', displayName: 'Tavily', priority: 10 },
  { providerKey: 'brave', displayName: 'Brave Search', priority: 20 },
  { providerKey: 'serper', displayName: 'Serper.dev', priority: 30 },
]);

const DEFAULT_CONFIG = Object.freeze({});
const DEFAULT_OPERATION = 'search';
const DEFAULT_PURPOSE = 'classification';
const DEFAULT_STATUS = 'success';
const FAILED_STATUS = 'failed';

function assertProviderKey(providerKey) {
  const normalized = normalizeWebSearchProviderKey(providerKey);
  if (normalized === 'unknown') {
    throw new Error('Invalid web search provider key');
  }
  return normalized;
}

function toNullableInteger(value) {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  return ['true', 't', '1', 'yes'].includes(String(value).toLowerCase());
}

function normalizeConfigValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_CONFIG };
  }
  return { ...value };
}

function maskApiKey(apiKey, maskSecrets) {
  if (!maskSecrets) return apiKey || null;
  return apiKey ? maskToken(apiKey) : null;
}

export function normalizeWebSearchProviderConfigRow(row, { maskSecrets = true } = {}) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    providerKey: row.provider_key,
    displayName: row.display_name,
    isEnabled: toBoolean(row.is_enabled),
    priority: Number.parseInt(row.priority ?? 100, 10),
    apiKey: maskApiKey(row.api_key, maskSecrets),
    configured: Boolean(row.api_key),
    config: normalizeConfigValue(row.config),
    softDailyLimit: toNullableInteger(row.soft_daily_limit),
    softMonthlyLimit: toNullableInteger(row.soft_monthly_limit),
    cooldownUntil: row.cooldown_until || null,
    lastSuccessAt: row.last_success_at || null,
    lastErrorAt: row.last_error_at || null,
    lastErrorCode: row.last_error_code || null,
    lastErrorMessage: row.last_error_message || null,
    lastErrorHttpStatus: toNullableInteger(row.last_error_http_status),
    legacySource: row.legacy_source || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function projectLegacyTavilyConfig(row, { maskSecrets = true } = {}) {
  if (!row) return null;
  return normalizeWebSearchProviderConfigRow({
    id: null,
    provider_key: 'tavily',
    display_name: 'Tavily',
    is_enabled: row.is_active,
    priority: 10,
    api_key: row.api_key,
    config: {
      searchDepth: row.search_depth || 'advanced',
      maxResults: toNullableInteger(row.max_results) || 5,
      includeDomains: row.include_domains || ['imdb.com', 'rottentomatoes.com'],
      excludeDomains: row.exclude_domains || [],
    },
    soft_daily_limit: null,
    soft_monthly_limit: null,
    cooldown_until: null,
    last_success_at: null,
    last_error_at: null,
    last_error_code: null,
    last_error_message: null,
    last_error_http_status: null,
    legacy_source: 'tavily_config',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }, { maskSecrets });
}

export function normalizeWebSearchProviderUsageRow(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    providerKey: row.provider_key,
    purpose: row.purpose,
    operation: row.operation,
    status: row.status,
    costUnits: Number.parseInt(row.cost_units ?? 0, 10),
    resultCount: Number.parseInt(row.result_count ?? 0, 10),
    durationMs: toNullableInteger(row.duration_ms),
    searchedAt: row.searched_at || null,
    correlationId: row.correlation_id || null,
    classificationId: row.classification_id ?? null,
    errorCode: row.error_code || null,
    httpStatus: toNullableInteger(row.http_status),
    retryable: toBoolean(row.retryable),
    cooldownEligible: toBoolean(row.cooldown_eligible),
    retryAfterSeconds: toNullableInteger(row.retry_after_seconds),
    metadata: normalizeConfigValue(row.metadata),
  };
}

export function normalizeWebSearchProviderUsageSummaryRow(row) {
  if (!row) return null;
  return {
    providerKey: row.provider_key,
    dailyCostUnits: Number.parseInt(row.daily_cost_units ?? 0, 10),
    monthlyCostUnits: Number.parseInt(row.monthly_cost_units ?? 0, 10),
    dailyRequestCount: Number.parseInt(row.daily_request_count ?? 0, 10),
    monthlyRequestCount: Number.parseInt(row.monthly_request_count ?? 0, 10),
    dailyCacheHits: Number.parseInt(row.daily_cache_hits ?? 0, 10),
    monthlyCacheHits: Number.parseInt(row.monthly_cache_hits ?? 0, 10),
  };
}

export class WebSearchProviderStorage {
  constructor({ db = defaultDb } = {}) {
    this.db = db;
  }

  withDb(db) {
    return new WebSearchProviderStorage({ db });
  }

  async listProviderConfigs({ includeDisabled = true, maskSecrets = true, includeLegacyBridge = true } = {}) {
    const whereClause = includeDisabled ? '' : 'WHERE is_enabled = true';
    const result = await this.db.query(
      `SELECT *
         FROM web_search_provider_config
         ${whereClause}
        ORDER BY priority ASC, provider_key ASC`
    );

    const configs = result.rows.map((row) => normalizeWebSearchProviderConfigRow(row, { maskSecrets }));

    if (includeLegacyBridge && !configs.some((config) => config.providerKey === 'tavily')) {
      const legacy = await this.getLegacyTavilyConfig({ maskSecrets });
      if (legacy && (includeDisabled || legacy.isEnabled)) {
        configs.push(legacy);
        configs.sort((left, right) => left.priority - right.priority || left.providerKey.localeCompare(right.providerKey));
      }
    }

    return configs;
  }

  async getProviderConfig(providerKey, { maskSecrets = true, includeLegacyBridge = true } = {}) {
    const normalizedProviderKey = assertProviderKey(providerKey);
    const result = await this.db.query(
      `SELECT *
         FROM web_search_provider_config
        WHERE provider_key = $1
        LIMIT 1`,
      [normalizedProviderKey]
    );

    if (result.rows[0]) {
      return normalizeWebSearchProviderConfigRow(result.rows[0], { maskSecrets });
    }

    if (includeLegacyBridge && normalizedProviderKey === 'tavily') {
      return this.getLegacyTavilyConfig({ maskSecrets });
    }

    return null;
  }

  async getLegacyTavilyConfig({ maskSecrets = true } = {}) {
    const result = await this.db.query(
      `SELECT *
         FROM tavily_config
        ORDER BY id DESC
        LIMIT 1`
    );
    return projectLegacyTavilyConfig(result.rows[0], { maskSecrets });
  }

  async upsertProviderConfig(input = {}, { maskSecrets = true } = {}) {
    const providerKey = assertProviderKey(input.providerKey);
    const defaultProvider = WEB_SEARCH_PROVIDER_STORAGE_DEFAULTS
      .find((provider) => provider.providerKey === providerKey);
    const displayName = String(input.displayName || defaultProvider?.displayName || providerKey).trim();
    const priority = toNullableInteger(input.priority) ?? defaultProvider?.priority ?? 100;
    const config = normalizeConfigValue(input.config);
    const clearApiKey = Boolean(input.clearApiKey);

    const result = await this.db.query(
      `INSERT INTO web_search_provider_config (
          provider_key,
          display_name,
          is_enabled,
          priority,
          api_key,
          config,
          soft_daily_limit,
          soft_monthly_limit,
          cooldown_until,
          updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, NOW())
       ON CONFLICT (provider_key) DO UPDATE
       SET
          display_name = EXCLUDED.display_name,
          is_enabled = EXCLUDED.is_enabled,
          priority = EXCLUDED.priority,
          api_key = CASE
            WHEN $10::boolean THEN NULL
            ELSE COALESCE(EXCLUDED.api_key, web_search_provider_config.api_key)
          END,
          config = EXCLUDED.config,
          soft_daily_limit = EXCLUDED.soft_daily_limit,
          soft_monthly_limit = EXCLUDED.soft_monthly_limit,
          cooldown_until = EXCLUDED.cooldown_until,
          updated_at = NOW()
       RETURNING *`,
      [
        providerKey,
        displayName,
        Boolean(input.isEnabled),
        priority,
        clearApiKey ? null : (input.apiKey ?? null),
        JSON.stringify(config),
        toNullableInteger(input.softDailyLimit),
        toNullableInteger(input.softMonthlyLimit),
        input.cooldownUntil || null,
        clearApiKey,
      ]
    );

    return normalizeWebSearchProviderConfigRow(result.rows[0], { maskSecrets });
  }

  async recordUsage(input = {}) {
    const providerKey = assertProviderKey(input.providerKey);
    const error = input.error || null;
    const status = input.status || (error?.code === 'rate_limited'
      ? 'rate_limited'
      : (error?.code === 'quota_exhausted' ? 'quota_exhausted' : (error ? FAILED_STATUS : DEFAULT_STATUS)));

    const result = await this.db.query(
      `INSERT INTO web_search_provider_usage (
          provider_key,
          purpose,
          operation,
          status,
          cost_units,
          result_count,
          duration_ms,
          correlation_id,
          classification_id,
          error_code,
          http_status,
          retryable,
          cooldown_eligible,
          retry_after_seconds,
          metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
       RETURNING *`,
      [
        providerKey,
        input.purpose || DEFAULT_PURPOSE,
        input.operation || DEFAULT_OPERATION,
        status,
        toNullableInteger(input.costUnits) ?? 1,
        toNullableInteger(input.resultCount) ?? 0,
        toNullableInteger(input.durationMs),
        input.correlationId || null,
        input.classificationId ?? null,
        error?.code || input.errorCode || null,
        toNullableInteger(error?.httpStatus ?? input.httpStatus),
        Boolean(error?.retryable ?? input.retryable),
        Boolean(error?.cooldownEligible ?? input.cooldownEligible),
        toNullableInteger(error?.retryAfterSeconds ?? input.retryAfterSeconds),
        JSON.stringify(normalizeConfigValue(input.metadata)),
      ]
    );

    return normalizeWebSearchProviderUsageRow(result.rows[0]);
  }

  async getProviderUsageSummaries(providerKeys = [], { now = new Date() } = {}) {
    const normalizedProviderKeys = [...new Set(providerKeys.map(assertProviderKey))];
    if (normalizedProviderKeys.length === 0) return new Map();

    const result = await this.db.query(
      `SELECT
          provider_key,
          COALESCE(SUM(cost_units) FILTER (
            WHERE searched_at >= date_trunc('day', $2::timestamptz)
          ), 0)::integer AS daily_cost_units,
          COALESCE(SUM(cost_units) FILTER (
            WHERE searched_at >= date_trunc('month', $2::timestamptz)
          ), 0)::integer AS monthly_cost_units,
          COALESCE(COUNT(*) FILTER (
            WHERE searched_at >= date_trunc('day', $2::timestamptz)
          ), 0)::integer AS daily_request_count,
          COALESCE(COUNT(*) FILTER (
            WHERE searched_at >= date_trunc('month', $2::timestamptz)
          ), 0)::integer AS monthly_request_count,
          COALESCE(COUNT(*) FILTER (
            WHERE operation = 'cache_hit'
              AND searched_at >= date_trunc('day', $2::timestamptz)
          ), 0)::integer AS daily_cache_hits,
          COALESCE(COUNT(*) FILTER (
            WHERE operation = 'cache_hit'
              AND searched_at >= date_trunc('month', $2::timestamptz)
          ), 0)::integer AS monthly_cache_hits
         FROM web_search_provider_usage
        WHERE provider_key = ANY($1::varchar[])
          AND searched_at >= date_trunc('month', $2::timestamptz)
        GROUP BY provider_key`,
      [normalizedProviderKeys, now]
    );

    return result.rows.reduce((summaries, row) => {
      const summary = normalizeWebSearchProviderUsageSummaryRow(row);
      summaries.set(summary.providerKey, summary);
      return summaries;
    }, new Map());
  }

  async updateProviderAfterUsage(providerKey, usage = {}) {
    const normalizedProviderKey = assertProviderKey(providerKey);
    const error = usage.error || null;
    if (!error && usage.status === 'success') {
      const result = await this.db.query(
        `UPDATE web_search_provider_config
            SET last_success_at = NOW(),
                last_error_at = NULL,
                last_error_code = NULL,
                last_error_message = NULL,
                last_error_http_status = NULL,
                updated_at = NOW()
          WHERE provider_key = $1
          RETURNING *`,
        [normalizedProviderKey]
      );
      return normalizeWebSearchProviderConfigRow(result.rows[0], { maskSecrets: false });
    }

    if (!error) return null;

    const result = await this.db.query(
      `UPDATE web_search_provider_config
          SET last_error_at = NOW(),
              last_error_code = $2,
              last_error_message = $3,
              last_error_http_status = $4,
              cooldown_until = CASE
                WHEN $5::integer IS NOT NULL THEN NOW() + ($5::integer * INTERVAL '1 second')
                ELSE cooldown_until
              END,
              updated_at = NOW()
        WHERE provider_key = $1
        RETURNING *`,
      [
        normalizedProviderKey,
        error.code || null,
        error.message || null,
        toNullableInteger(error.httpStatus),
        toNullableInteger(error.retryAfterSeconds),
      ]
    );
    return normalizeWebSearchProviderConfigRow(result.rows[0], { maskSecrets: false });
  }
}

export const webSearchProviderStorage = new WebSearchProviderStorage();
