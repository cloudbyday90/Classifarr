/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  WEB_SEARCH_PROVIDER_GUARDRAIL_ANALYTICS_DEFAULTS,
  webSearchProviderGuardrailAnalyticsService as defaultGuardrailAnalyticsService,
} from './webSearchProviderGuardrailAnalytics.mjs';

export const WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS = Object.freeze({
  CLEAR: 'clear',
  WATCH: 'watch',
  ATTENTION: 'attention',
});

export const WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_DEFAULTS = Object.freeze({
  lookbackDays: 7,
  maxFindings: 5,
  criticalEventThreshold: 1,
  warningEventThreshold: 5,
  totalEventThreshold: 10,
});

const GUARDRAIL_MESSAGES = Object.freeze({
  no_preview_provider: 'Preview frequently cannot select an eligible web search provider.',
  selected_provider_changed: 'Preview frequently changes the selected web search provider.',
  selected_provider_low_samples: 'Preview-selected providers often have weak sample confidence.',
  selected_provider_recent_health_issue: 'Preview-selected providers have repeated recent health or cooldown signals.',
});

const GUARDRAIL_RECOMMENDATIONS = Object.freeze({
  no_preview_provider: 'Check provider configuration, API keys, cooldowns, and quota limits before tightening calibration policy.',
  selected_provider_changed: 'Review whether the calibration change matches the intended provider priority for this purpose.',
  selected_provider_low_samples: 'Let more routed searches accumulate or lower sample sensitivity only if the provider behavior is understood.',
  selected_provider_recent_health_issue: 'Inspect provider health history and cooldown settings before relying on this provider for the purpose.',
});

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(parsed, maximum));
}

function normalizeDigestPolicy(input = {}) {
  return Object.freeze({
    lookbackDays: clampInteger(
      input.lookbackDays,
      WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_DEFAULTS.lookbackDays,
      1,
      WEB_SEARCH_PROVIDER_GUARDRAIL_ANALYTICS_DEFAULTS.retentionDays
    ),
    maxFindings: clampInteger(input.maxFindings, WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_DEFAULTS.maxFindings, 1, 20),
    criticalEventThreshold: clampInteger(
      input.criticalEventThreshold,
      WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_DEFAULTS.criticalEventThreshold,
      1,
      100
    ),
    warningEventThreshold: clampInteger(
      input.warningEventThreshold,
      WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_DEFAULTS.warningEventThreshold,
      1,
      250
    ),
    totalEventThreshold: clampInteger(
      input.totalEventThreshold,
      WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_DEFAULTS.totalEventThreshold,
      1,
      500
    ),
  });
}

function getDigestLevel(row = {}, policy = WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_DEFAULTS) {
  if (row.criticalCount >= policy.criticalEventThreshold) {
    return WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.ATTENTION;
  }
  if (
    row.warningCount >= policy.warningEventThreshold
    || row.totalCount >= policy.totalEventThreshold
  ) {
    return WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.WATCH;
  }
  return WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.CLEAR;
}

function getDominantSeverity(row = {}) {
  if (row.criticalCount > 0) return 'critical';
  if (row.warningCount > 0) return 'warning';
  return 'info';
}

export function buildGuardrailDigestFinding(row = {}, policy = WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_DEFAULTS) {
  const level = getDigestLevel(row, policy);
  if (level === WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.CLEAR) return null;

  return Object.freeze({
    guardrailCode: row.guardrailCode,
    level,
    dominantSeverity: getDominantSeverity(row),
    totalCount: row.totalCount,
    criticalCount: row.criticalCount,
    warningCount: row.warningCount,
    infoCount: row.infoCount,
    providerCount: row.providerCount,
    latestAt: row.latestAt,
    message: GUARDRAIL_MESSAGES[row.guardrailCode] || 'Preview guardrail activity is repeatedly crossing digest thresholds.',
    recommendation: GUARDRAIL_RECOMMENDATIONS[row.guardrailCode] || 'Review the related guardrail analytics before changing provider calibration.',
  });
}

function getOverallLevel(findings = []) {
  if (findings.some((finding) => finding.level === WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.ATTENTION)) {
    return WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.ATTENTION;
  }
  if (findings.some((finding) => finding.level === WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.WATCH)) {
    return WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.WATCH;
  }
  return WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.CLEAR;
}

export class WebSearchProviderGuardrailDigestService {
  constructor({
    analyticsService = defaultGuardrailAnalyticsService,
    nowFn = () => new Date(),
  } = {}) {
    this.analyticsService = analyticsService;
    this.nowFn = nowFn;
  }

  withDependencies(dependencies = {}) {
    return new WebSearchProviderGuardrailDigestService({
      analyticsService: dependencies.analyticsService || this.analyticsService,
      nowFn: dependencies.nowFn || this.nowFn,
    });
  }

  async buildDigest(policyInput = {}) {
    const policy = normalizeDigestPolicy(policyInput);
    const summary = await this.analyticsService.summarize({
      lookbackDays: policy.lookbackDays,
      limit: 50,
    });
    const findings = summary.codes
      .map((row) => buildGuardrailDigestFinding(row, policy))
      .filter(Boolean)
      .slice(0, policy.maxFindings);
    const level = getOverallLevel(findings);

    return Object.freeze({
      generatedAt: this.nowFn().toISOString(),
      level,
      lookbackDays: policy.lookbackDays,
      policy,
      summary: Object.freeze({
        totalCount: summary.totalCount,
        criticalCount: summary.criticalCount,
        warningCount: summary.warningCount,
        infoCount: summary.infoCount,
        purposeCount: summary.purposeCount,
        latestAt: summary.latestAt,
      }),
      findings: Object.freeze(findings),
      message: level === WEB_SEARCH_PROVIDER_GUARDRAIL_DIGEST_LEVELS.CLEAR
        ? 'No guardrail digest findings crossed the current threshold window.'
        : 'Guardrail activity crossed digest thresholds and should be reviewed before further calibration changes.',
    });
  }
}

export const webSearchProviderGuardrailDigestService = new WebSearchProviderGuardrailDigestService();
