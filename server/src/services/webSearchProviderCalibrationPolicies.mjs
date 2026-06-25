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
import { ValidationError } from '../utils/appError.mjs';
import { WEB_SEARCH_PURPOSES } from './webSearchProviderContract.mjs';

export const DEFAULT_WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE = 'classification';
export const WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE_PATTERN = /^[a-z0-9_-]{1,60}$/;

export const WEB_SEARCH_PROVIDER_CALIBRATION_POLICY_DEFAULTS = Object.freeze({
  purpose: DEFAULT_WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE,
  isEnabled: true,
  lookbackDays: 14,
  minimumSamples: 3,
  maximumPriorityPenalty: 25,
  outcomeWeight: 15,
});

const POLICY_LIMITS = Object.freeze({
  lookbackDays: Object.freeze({ minimum: 1, maximum: 90 }),
  minimumSamples: Object.freeze({ minimum: 1, maximum: 100 }),
  maximumPriorityPenalty: Object.freeze({ minimum: 0, maximum: 100 }),
  outcomeWeight: Object.freeze({ minimum: 0, maximum: 50 }),
});

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function toBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeBoundedInteger(value, fallback, limits) {
  return clamp(toInteger(value, fallback), limits.minimum, limits.maximum);
}

export function normalizeWebSearchProviderCalibrationPurpose(value) {
  const normalized = String(value || DEFAULT_WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE)
    .trim()
    .toLowerCase();

  if (!WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE_PATTERN.test(normalized)) {
    throw new ValidationError('Invalid web search calibration purpose', {
      code: 'invalid_calibration_purpose',
      purpose: value,
    });
  }

  return normalized;
}

export function normalizeWebSearchProviderCalibrationPolicy(input = {}) {
  const purpose = normalizeWebSearchProviderCalibrationPurpose(input.purpose);
  const defaults = WEB_SEARCH_PROVIDER_CALIBRATION_POLICY_DEFAULTS;

  return Object.freeze({
    purpose,
    isEnabled: toBoolean(input.isEnabled ?? input.is_enabled, defaults.isEnabled),
    lookbackDays: normalizeBoundedInteger(
      input.lookbackDays ?? input.lookback_days,
      defaults.lookbackDays,
      POLICY_LIMITS.lookbackDays
    ),
    minimumSamples: normalizeBoundedInteger(
      input.minimumSamples ?? input.minimum_samples,
      defaults.minimumSamples,
      POLICY_LIMITS.minimumSamples
    ),
    maximumPriorityPenalty: normalizeBoundedInteger(
      input.maximumPriorityPenalty ?? input.maximum_priority_penalty,
      defaults.maximumPriorityPenalty,
      POLICY_LIMITS.maximumPriorityPenalty
    ),
    outcomeWeight: normalizeBoundedInteger(
      input.outcomeWeight ?? input.outcome_weight,
      defaults.outcomeWeight,
      POLICY_LIMITS.outcomeWeight
    ),
    updatedAt: input.updatedAt ?? input.updated_at ?? null,
  });
}

function defaultPolicyForPurpose(purpose = DEFAULT_WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE) {
  return normalizeWebSearchProviderCalibrationPolicy({
    ...WEB_SEARCH_PROVIDER_CALIBRATION_POLICY_DEFAULTS,
    purpose,
  });
}

function buildPolicyRowMap(rows = []) {
  return rows.reduce((map, row) => {
    const policy = normalizeWebSearchProviderCalibrationPolicy(row);
    map.set(policy.purpose, policy);
    return map;
  }, new Map());
}

function compareCoveragePurposes(knownPurposeOrder = []) {
  const knownIndex = new Map(knownPurposeOrder.map((purpose, index) => [purpose, index]));
  return (left, right) => {
    const leftIndex = knownIndex.has(left) ? knownIndex.get(left) : Number.MAX_SAFE_INTEGER;
    const rightIndex = knownIndex.has(right) ? knownIndex.get(right) : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || left.localeCompare(right);
  };
}

export class WebSearchProviderCalibrationPolicyService {
  constructor({ db = defaultDb } = {}) {
    this.db = db;
  }

  withDb(db) {
    return new WebSearchProviderCalibrationPolicyService({ db });
  }

  async listPolicies() {
    const result = await this.db.query(
      `SELECT
          purpose,
          is_enabled,
          lookback_days,
          minimum_samples,
          maximum_priority_penalty,
          outcome_weight,
          updated_at
         FROM web_search_provider_calibration_policies
        ORDER BY purpose`
    );

    const policies = result.rows.map((row) => normalizeWebSearchProviderCalibrationPolicy(row));
    if (!policies.some((policy) => policy.purpose === DEFAULT_WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE)) {
      return [defaultPolicyForPurpose(), ...policies];
    }
    return policies;
  }

  async listPolicyCoverage({ purposes = WEB_SEARCH_PURPOSES } = {}) {
    const result = await this.db.query(
      `SELECT
          purpose,
          is_enabled,
          lookback_days,
          minimum_samples,
          maximum_priority_penalty,
          outcome_weight,
          updated_at
         FROM web_search_provider_calibration_policies
        ORDER BY purpose`
    );
    const knownPurposes = purposes.map((purpose) => normalizeWebSearchProviderCalibrationPurpose(purpose));
    const explicitPolicies = buildPolicyRowMap(result.rows);
    const allPurposes = [...new Set([
      ...knownPurposes,
      ...explicitPolicies.keys(),
    ])].sort(compareCoveragePurposes(knownPurposes));
    const entries = allPurposes.map((purpose) => {
      const explicitPolicy = explicitPolicies.get(purpose) || null;
      const policy = explicitPolicy || defaultPolicyForPurpose(purpose);
      const knownPurpose = knownPurposes.includes(purpose);

      return Object.freeze({
        purpose,
        knownPurpose,
        hasExplicitPolicy: Boolean(explicitPolicy),
        coverageSource: explicitPolicy ? 'explicit' : 'default',
        status: explicitPolicy ? 'covered' : 'fallback',
        fallbackReason: explicitPolicy ? null : 'default_policy',
        policy,
      });
    });

    const explicitCount = entries.filter((entry) => entry.hasExplicitPolicy).length;
    const fallbackCount = entries.length - explicitCount;

    return Object.freeze({
      generatedAt: new Date().toISOString(),
      totalPurposes: entries.length,
      knownPurposeCount: knownPurposes.length,
      explicitPolicyCount: explicitCount,
      fallbackPolicyCount: fallbackCount,
      purposes: Object.freeze(entries),
    });
  }

  async getPolicyForPurpose(purpose = DEFAULT_WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE) {
    const normalizedPurpose = normalizeWebSearchProviderCalibrationPurpose(purpose);
    const result = await this.db.query(
      `SELECT
          purpose,
          is_enabled,
          lookback_days,
          minimum_samples,
          maximum_priority_penalty,
          outcome_weight,
          updated_at
         FROM web_search_provider_calibration_policies
        WHERE purpose = $1
        LIMIT 1`,
      [normalizedPurpose]
    );

    return result.rows[0]
      ? normalizeWebSearchProviderCalibrationPolicy(result.rows[0])
      : defaultPolicyForPurpose(normalizedPurpose);
  }

  async getPolicyForPurposeSafely(purpose = DEFAULT_WEB_SEARCH_PROVIDER_CALIBRATION_PURPOSE) {
    try {
      return await this.getPolicyForPurpose(purpose);
    } catch (_error) {
      return defaultPolicyForPurpose(purpose);
    }
  }

  async upsertPolicy(input = {}) {
    const policy = normalizeWebSearchProviderCalibrationPolicy(input);
    const result = await this.db.query(
      `INSERT INTO web_search_provider_calibration_policies (
          purpose,
          is_enabled,
          lookback_days,
          minimum_samples,
          maximum_priority_penalty,
          outcome_weight,
          updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (purpose) DO UPDATE SET
          is_enabled = EXCLUDED.is_enabled,
          lookback_days = EXCLUDED.lookback_days,
          minimum_samples = EXCLUDED.minimum_samples,
          maximum_priority_penalty = EXCLUDED.maximum_priority_penalty,
          outcome_weight = EXCLUDED.outcome_weight,
          updated_at = NOW()
       RETURNING
          purpose,
          is_enabled,
          lookback_days,
          minimum_samples,
          maximum_priority_penalty,
          outcome_weight,
          updated_at`,
      [
        policy.purpose,
        policy.isEnabled,
        policy.lookbackDays,
        policy.minimumSamples,
        policy.maximumPriorityPenalty,
        policy.outcomeWeight,
      ]
    );

    return normalizeWebSearchProviderCalibrationPolicy(result.rows[0]);
  }
}

export const webSearchProviderCalibrationPolicyService = new WebSearchProviderCalibrationPolicyService();
