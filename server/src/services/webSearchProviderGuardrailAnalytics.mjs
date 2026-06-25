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
import { normalizeWebSearchProviderKey } from './webSearchResultNormalizer.mjs';

export const WEB_SEARCH_PROVIDER_GUARDRAIL_ANALYTICS_DEFAULTS = Object.freeze({
  lookbackDays: 30,
  retentionDays: 62,
  limit: 10,
});

export const WEB_SEARCH_PROVIDER_GUARDRAIL_SEVERITIES = Object.freeze([
  'info',
  'warning',
  'critical',
]);

const PURPOSE_PATTERN = /^[a-z0-9_-]{1,60}$/;
const GUARDRAIL_CODE_PATTERN = /^[a-z0-9_]{1,80}$/;

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(parsed, maximum));
}

function toIsoTimestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeGuardrailAnalyticsPurpose(value) {
  const purpose = String(value || 'classification').trim().toLowerCase();
  return PURPOSE_PATTERN.test(purpose) ? purpose : 'classification';
}

export function normalizeGuardrailAnalyticsCode(value) {
  const code = String(value || '').trim().toLowerCase();
  return GUARDRAIL_CODE_PATTERN.test(code) ? code : null;
}

export function normalizeGuardrailAnalyticsSeverity(value) {
  return WEB_SEARCH_PROVIDER_GUARDRAIL_SEVERITIES.includes(value) ? value : 'info';
}

function normalizeNullableProviderKey(value) {
  if (!value) return null;
  const normalized = normalizeWebSearchProviderKey(value);
  return normalized === 'unknown' ? null : normalized;
}

function sanitizeMetadata(guardrail = {}) {
  const details = guardrail.details && typeof guardrail.details === 'object' && !Array.isArray(guardrail.details)
    ? guardrail.details
    : {};
  const metadata = {};

  if (Number.isFinite(Number(details.sampleCount))) {
    metadata.sampleCount = Math.max(0, Number.parseInt(details.sampleCount, 10));
  }
  if (Number.isFinite(Number(details.minimumSamples))) {
    metadata.minimumSamples = Math.max(0, Number.parseInt(details.minimumSamples, 10));
  }
  if (typeof details.healthStatus === 'string') {
    metadata.healthStatus = details.healthStatus.slice(0, 40);
  }
  if (typeof details.eventType === 'string') {
    metadata.eventType = details.eventType.slice(0, 40);
  }

  return metadata;
}

export function buildGuardrailAnalyticsEvent({ purpose, guardrail } = {}) {
  const guardrailCode = normalizeGuardrailAnalyticsCode(guardrail?.code);
  if (!guardrailCode) return null;

  return Object.freeze({
    purpose: normalizeGuardrailAnalyticsPurpose(purpose),
    guardrailCode,
    severity: normalizeGuardrailAnalyticsSeverity(guardrail.severity),
    providerKey: normalizeNullableProviderKey(guardrail.providerKey),
    metadata: Object.freeze(sanitizeMetadata(guardrail)),
  });
}

export function normalizeGuardrailAnalyticsSummaryRow(row = {}) {
  return Object.freeze({
    guardrailCode: row.guardrail_code,
    totalCount: Number(row.total_count || 0),
    criticalCount: Number(row.critical_count || 0),
    warningCount: Number(row.warning_count || 0),
    infoCount: Number(row.info_count || 0),
    providerCount: Number(row.provider_count || 0),
    latestAt: toIsoTimestamp(row.latest_at),
  });
}

export function normalizeGuardrailAnalyticsPurposeRow(row = {}) {
  return Object.freeze({
    purpose: row.purpose,
    totalCount: Number(row.total_count || 0),
    latestAt: toIsoTimestamp(row.latest_at),
  });
}

export class WebSearchProviderGuardrailAnalyticsService {
  constructor({
    db = defaultDb,
    nowFn = () => new Date(),
    logger = console,
    retentionDays = WEB_SEARCH_PROVIDER_GUARDRAIL_ANALYTICS_DEFAULTS.retentionDays,
  } = {}) {
    this.db = db;
    this.nowFn = nowFn;
    this.logger = logger;
    this.retentionDays = clampInteger(
      retentionDays,
      WEB_SEARCH_PROVIDER_GUARDRAIL_ANALYTICS_DEFAULTS.retentionDays,
      1,
      365
    );
  }

  withDependencies(dependencies = {}) {
    return new WebSearchProviderGuardrailAnalyticsService({
      db: dependencies.db || this.db,
      nowFn: dependencies.nowFn || this.nowFn,
      logger: dependencies.logger || this.logger,
      retentionDays: dependencies.retentionDays || this.retentionDays,
    });
  }

  async recordPreviewGuardrails({ purpose, guardrails = [], createdAt = this.nowFn() } = {}) {
    const events = guardrails
      .map((guardrail) => buildGuardrailAnalyticsEvent({ purpose, guardrail }))
      .filter(Boolean);

    if (!events.length) {
      return Object.freeze({ recorded: 0 });
    }

    const rows = events.map((event) => ({
      purpose: event.purpose,
      guardrail_code: event.guardrailCode,
      severity: event.severity,
      provider_key: event.providerKey,
      metadata: event.metadata,
      created_at: createdAt,
    }));

    await this.db.query(
      `INSERT INTO web_search_provider_guardrail_events (
          purpose,
          guardrail_code,
          severity,
          provider_key,
          metadata,
          created_at
       )
       SELECT
          row_data.purpose,
          row_data.guardrail_code,
          row_data.severity,
          row_data.provider_key,
          row_data.metadata,
          row_data.created_at
       FROM jsonb_to_recordset($1::jsonb) AS row_data(
          purpose text,
          guardrail_code text,
          severity text,
          provider_key text,
          metadata jsonb,
          created_at timestamptz
       )`,
      [JSON.stringify(rows)]
    );

    await this.pruneOldEvents();
    return Object.freeze({ recorded: rows.length });
  }

  async recordPreviewGuardrailsSafely(input = {}) {
    try {
      return await this.recordPreviewGuardrails(input);
    } catch (error) {
      this.logger.warn?.('Failed to record web search provider guardrail analytics', {
        error: error.message,
      });
      return Object.freeze({ recorded: 0, error: 'record_failed' });
    }
  }

  async pruneOldEvents({ retentionDays = this.retentionDays } = {}) {
    const boundedRetentionDays = clampInteger(
      retentionDays,
      this.retentionDays,
      1,
      365
    );
    await this.db.query(
      `DELETE FROM web_search_provider_guardrail_events
        WHERE created_at < NOW() - ($1::integer * INTERVAL '1 day')`,
      [boundedRetentionDays]
    );
  }

  async summarize({
    lookbackDays = WEB_SEARCH_PROVIDER_GUARDRAIL_ANALYTICS_DEFAULTS.lookbackDays,
    limit = WEB_SEARCH_PROVIDER_GUARDRAIL_ANALYTICS_DEFAULTS.limit,
  } = {}) {
    const boundedLookbackDays = clampInteger(lookbackDays, 30, 1, 90);
    const boundedLimit = clampInteger(limit, 10, 1, 50);
    const params = [boundedLookbackDays, boundedLimit];

    const [totalsResult, codesResult, purposesResult] = await Promise.all([
      this.db.query(
        `SELECT
            COUNT(*)::integer AS total_count,
            COUNT(*) FILTER (WHERE severity = 'critical')::integer AS critical_count,
            COUNT(*) FILTER (WHERE severity = 'warning')::integer AS warning_count,
            COUNT(*) FILTER (WHERE severity = 'info')::integer AS info_count,
            COUNT(DISTINCT purpose)::integer AS purpose_count,
            MAX(created_at) AS latest_at
           FROM web_search_provider_guardrail_events
          WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')`,
        [boundedLookbackDays]
      ),
      this.db.query(
        `SELECT
            guardrail_code,
            COUNT(*)::integer AS total_count,
            COUNT(*) FILTER (WHERE severity = 'critical')::integer AS critical_count,
            COUNT(*) FILTER (WHERE severity = 'warning')::integer AS warning_count,
            COUNT(*) FILTER (WHERE severity = 'info')::integer AS info_count,
            COUNT(DISTINCT provider_key) FILTER (WHERE provider_key IS NOT NULL)::integer AS provider_count,
            MAX(created_at) AS latest_at
           FROM web_search_provider_guardrail_events
          WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')
          GROUP BY guardrail_code
          ORDER BY total_count DESC, guardrail_code ASC
          LIMIT $2`,
        params
      ),
      this.db.query(
        `SELECT
            purpose,
            COUNT(*)::integer AS total_count,
            MAX(created_at) AS latest_at
           FROM web_search_provider_guardrail_events
          WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')
          GROUP BY purpose
          ORDER BY total_count DESC, purpose ASC
          LIMIT $2`,
        params
      ),
    ]);

    const totals = totalsResult.rows[0] || {};
    return Object.freeze({
      generatedAt: this.nowFn().toISOString(),
      lookbackDays: boundedLookbackDays,
      totalCount: Number(totals.total_count || 0),
      criticalCount: Number(totals.critical_count || 0),
      warningCount: Number(totals.warning_count || 0),
      infoCount: Number(totals.info_count || 0),
      purposeCount: Number(totals.purpose_count || 0),
      latestAt: toIsoTimestamp(totals.latest_at),
      codes: Object.freeze(codesResult.rows.map(normalizeGuardrailAnalyticsSummaryRow)),
      purposes: Object.freeze(purposesResult.rows.map(normalizeGuardrailAnalyticsPurposeRow)),
    });
  }
}

export const webSearchProviderGuardrailAnalyticsService = new WebSearchProviderGuardrailAnalyticsService();
