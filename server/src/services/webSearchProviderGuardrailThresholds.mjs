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

export const WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLDS_SETTING_KEY = 'web_search_provider_guardrail_thresholds';

export const WEB_SEARCH_PROVIDER_GUARDRAIL_SEVERITIES = Object.freeze([
  'info',
  'warning',
  'critical',
  'disabled',
]);

export const WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS = Object.freeze({
  enabled: true,
  lowSampleMultiplier: 1,
  recentHealthLookbackCount: 10,
  selectionChangeSeverity: 'info',
  lowSampleSeverity: 'warning',
  healthIssueSeverity: 'warning',
  cooldownSeverity: 'critical',
  noProviderSeverity: 'critical',
  updatedAt: null,
});

const THRESHOLD_LIMITS = Object.freeze({
  lowSampleMultiplier: Object.freeze({ minimum: 0, maximum: 5 }),
  recentHealthLookbackCount: Object.freeze({ minimum: 0, maximum: 25 }),
});

function toBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeBoundedNumber(value, fallback, limits) {
  return clamp(toNumber(value, fallback), limits.minimum, limits.maximum);
}

function normalizeBoundedInteger(value, fallback, limits) {
  return clamp(toInteger(value, fallback), limits.minimum, limits.maximum);
}

function normalizeSeverity(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return WEB_SEARCH_PROVIDER_GUARDRAIL_SEVERITIES.includes(normalized)
    ? normalized
    : fallback;
}

function parseThresholdsValue(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function normalizeWebSearchProviderGuardrailThresholds(input = {}) {
  const raw = parseThresholdsValue(input);
  const defaults = WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS;

  return Object.freeze({
    enabled: toBoolean(raw.enabled, defaults.enabled),
    lowSampleMultiplier: normalizeBoundedNumber(
      raw.lowSampleMultiplier ?? raw.low_sample_multiplier,
      defaults.lowSampleMultiplier,
      THRESHOLD_LIMITS.lowSampleMultiplier
    ),
    recentHealthLookbackCount: normalizeBoundedInteger(
      raw.recentHealthLookbackCount ?? raw.recent_health_lookback_count,
      defaults.recentHealthLookbackCount,
      THRESHOLD_LIMITS.recentHealthLookbackCount
    ),
    selectionChangeSeverity: normalizeSeverity(
      raw.selectionChangeSeverity ?? raw.selection_change_severity,
      defaults.selectionChangeSeverity
    ),
    lowSampleSeverity: normalizeSeverity(
      raw.lowSampleSeverity ?? raw.low_sample_severity,
      defaults.lowSampleSeverity
    ),
    healthIssueSeverity: normalizeSeverity(
      raw.healthIssueSeverity ?? raw.health_issue_severity,
      defaults.healthIssueSeverity
    ),
    cooldownSeverity: normalizeSeverity(
      raw.cooldownSeverity ?? raw.cooldown_severity,
      defaults.cooldownSeverity
    ),
    noProviderSeverity: normalizeSeverity(
      raw.noProviderSeverity ?? raw.no_provider_severity,
      defaults.noProviderSeverity
    ),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
  });
}

export class WebSearchProviderGuardrailThresholdService {
  constructor({ db = defaultDb } = {}) {
    this.db = db;
  }

  withDb(db) {
    return new WebSearchProviderGuardrailThresholdService({ db });
  }

  async getThresholds() {
    const result = await this.db.query(
      `SELECT value, updated_at
         FROM settings
        WHERE key = $1
        LIMIT 1`,
      [WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLDS_SETTING_KEY]
    );

    const row = result.rows[0];
    return normalizeWebSearchProviderGuardrailThresholds({
      ...parseThresholdsValue(row?.value),
      updatedAt: row?.updated_at || null,
    });
  }

  async getThresholdsSafely() {
    try {
      return await this.getThresholds();
    } catch {
      return normalizeWebSearchProviderGuardrailThresholds();
    }
  }

  async updateThresholds(input = {}) {
    const thresholds = normalizeWebSearchProviderGuardrailThresholds(input);
    const payload = JSON.stringify({
      enabled: thresholds.enabled,
      lowSampleMultiplier: thresholds.lowSampleMultiplier,
      recentHealthLookbackCount: thresholds.recentHealthLookbackCount,
      selectionChangeSeverity: thresholds.selectionChangeSeverity,
      lowSampleSeverity: thresholds.lowSampleSeverity,
      healthIssueSeverity: thresholds.healthIssueSeverity,
      cooldownSeverity: thresholds.cooldownSeverity,
      noProviderSeverity: thresholds.noProviderSeverity,
    });

    const result = await this.db.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
       RETURNING value, updated_at`,
      [WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLDS_SETTING_KEY, payload]
    );

    const row = result.rows[0];
    return normalizeWebSearchProviderGuardrailThresholds({
      ...parseThresholdsValue(row?.value),
      updatedAt: row?.updated_at || null,
    });
  }
}

export const webSearchProviderGuardrailThresholdService = new WebSearchProviderGuardrailThresholdService();
