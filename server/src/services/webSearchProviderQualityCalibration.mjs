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
import {
  EMPTY_PROVIDER_OUTCOME_FEEDBACK_SUMMARY,
  webSearchProviderOutcomeFeedbackService as defaultOutcomeFeedbackService,
} from './webSearchProviderOutcomeFeedback.mjs';

export const WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS = Object.freeze({
  lookbackDays: 14,
  minimumSamples: 3,
  maximumPriorityPenalty: 25,
  outcomeWeight: 15,
  successWeight: 70,
  nonEmptyResultWeight: 20,
  latencyWeight: 10,
  latencyTargetMs: 2500,
  latencyMaxMs: 10000,
});

const DEFAULT_PURPOSE = 'classification';
const EMPTY_SUMMARY = Object.freeze({
  totalSearches: 0,
  successfulSearches: 0,
  failedSearches: 0,
  nonEmptySuccesses: 0,
  zeroResultSuccesses: 0,
  averageDurationMs: null,
  positiveOutcomes: 0,
  negativeOutcomes: 0,
  pendingOutcomes: 0,
  neutralOutcomes: 0,
  outcomeSignalCount: 0,
});

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeProviderKeys(providerKeys = []) {
  return [...new Set(providerKeys
    .map((providerKey) => normalizeWebSearchProviderKey(providerKey))
    .filter((providerKey) => providerKey !== 'unknown'))];
}

function normalizePurpose(purpose) {
  const normalized = String(purpose || DEFAULT_PURPOSE).trim();
  return normalized || DEFAULT_PURPOSE;
}

function normalizeOptions(options = {}) {
  return {
    lookbackDays: clamp(toInteger(options.lookbackDays, WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.lookbackDays), 1, 90),
    minimumSamples: clamp(toInteger(options.minimumSamples, WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.minimumSamples), 1, 100),
    maximumPriorityPenalty: clamp(
      toInteger(options.maximumPriorityPenalty, WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.maximumPriorityPenalty),
      0,
      100
    ),
    outcomeWeight: clamp(
      toInteger(options.outcomeWeight, WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.outcomeWeight),
      0,
      50
    ),
    successWeight: WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.successWeight,
    nonEmptyResultWeight: WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.nonEmptyResultWeight,
    latencyWeight: WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.latencyWeight,
    latencyTargetMs: WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.latencyTargetMs,
    latencyMaxMs: WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.latencyMaxMs,
  };
}

function normalizeSummaryRow(row = {}) {
  return {
    providerKey: row.provider_key,
    totalSearches: toInteger(row.total_searches),
    successfulSearches: toInteger(row.successful_searches),
    failedSearches: toInteger(row.failed_searches),
    nonEmptySuccesses: toInteger(row.non_empty_successes),
    zeroResultSuccesses: toInteger(row.zero_result_successes),
    averageDurationMs: toNullableNumber(row.average_duration_ms),
  };
}

function mergeOutcomeFeedbackSummary(summary = EMPTY_SUMMARY, feedbackSummary = EMPTY_PROVIDER_OUTCOME_FEEDBACK_SUMMARY) {
  return {
    ...summary,
    positiveOutcomes: toInteger(feedbackSummary.positiveOutcomes),
    negativeOutcomes: toInteger(feedbackSummary.negativeOutcomes),
    pendingOutcomes: toInteger(feedbackSummary.pendingOutcomes),
    neutralOutcomes: toInteger(feedbackSummary.neutralOutcomes),
    outcomeSignalCount: toInteger(feedbackSummary.outcomeSignalCount),
  };
}

export function calculateWebSearchProviderQuality(summary = EMPTY_SUMMARY, options = {}) {
  const config = normalizeOptions(options);
  const totalSearches = toInteger(summary.totalSearches);
  const successfulSearches = toInteger(summary.successfulSearches);
  const nonEmptySuccesses = toInteger(summary.nonEmptySuccesses);
  const averageDurationMs = toNullableNumber(summary.averageDurationMs);
  const outcomeSignalCount = toInteger(summary.outcomeSignalCount);
  const positiveOutcomes = toInteger(summary.positiveOutcomes);

  if (totalSearches < config.minimumSamples) {
    return Object.freeze({
      score: 100,
      priorityPenalty: 0,
      sampleCount: totalSearches,
      status: 'insufficient_data',
      successRate: null,
      nonEmptyResultRate: null,
      latencyScore: null,
      outcomePositiveRate: null,
      outcomeSignalCount,
      outcomePenalty: 0,
      lookbackDays: config.lookbackDays,
      minimumSamples: config.minimumSamples,
    });
  }

  const successRate = successfulSearches / totalSearches;
  const nonEmptyResultRate = successfulSearches > 0 ? nonEmptySuccesses / successfulSearches : 0;
  const latencyScore = averageDurationMs == null
    ? 1
    : 1 - clamp(
      (averageDurationMs - config.latencyTargetMs) / (config.latencyMaxMs - config.latencyTargetMs),
      0,
      1
    );
  const weightedScore = (
    successRate * config.successWeight
    + nonEmptyResultRate * config.nonEmptyResultWeight
    + latencyScore * config.latencyWeight
  );
  const outcomePositiveRate = outcomeSignalCount >= config.minimumSamples
    ? positiveOutcomes / outcomeSignalCount
    : null;
  const outcomePenalty = outcomePositiveRate == null
    ? 0
    : Math.round(clamp((1 - outcomePositiveRate) * config.outcomeWeight, 0, config.outcomeWeight));
  const score = Math.round(clamp(weightedScore - outcomePenalty, 0, 100));
  const priorityPenalty = Math.round(clamp((100 - score) / 4, 0, config.maximumPriorityPenalty));

  return Object.freeze({
    score,
    priorityPenalty,
    sampleCount: totalSearches,
    status: priorityPenalty > 0 ? 'calibrated' : 'healthy',
    successRate: Number(successRate.toFixed(4)),
    nonEmptyResultRate: Number(nonEmptyResultRate.toFixed(4)),
    latencyScore: Number(latencyScore.toFixed(4)),
    outcomePositiveRate: outcomePositiveRate == null ? null : Number(outcomePositiveRate.toFixed(4)),
    outcomeSignalCount,
    outcomePenalty,
    lookbackDays: config.lookbackDays,
    minimumSamples: config.minimumSamples,
  });
}

export function applyWebSearchProviderQualityCalibration(candidate = {}, calibration = {}) {
  const priority = toInteger(candidate.priority, 100);
  const priorityPenalty = toInteger(calibration.priorityPenalty, 0);
  return Object.freeze({
    ...candidate,
    effectivePriority: priority + priorityPenalty,
    qualityCalibration: Object.freeze({
      score: toInteger(calibration.score, 100),
      priorityPenalty,
      sampleCount: toInteger(calibration.sampleCount),
      status: calibration.status || 'insufficient_data',
      successRate: calibration.successRate ?? null,
      nonEmptyResultRate: calibration.nonEmptyResultRate ?? null,
      latencyScore: calibration.latencyScore ?? null,
      outcomePositiveRate: calibration.outcomePositiveRate ?? null,
      outcomeSignalCount: toInteger(calibration.outcomeSignalCount),
      outcomePenalty: toInteger(calibration.outcomePenalty),
      lookbackDays: toInteger(calibration.lookbackDays, WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.lookbackDays),
      minimumSamples: toInteger(calibration.minimumSamples, WEB_SEARCH_PROVIDER_QUALITY_DEFAULTS.minimumSamples),
    }),
  });
}

export function sortWebSearchProviderCandidatesByQuality(candidates = []) {
  return [...candidates].sort((left, right) => (
    toInteger(left.effectivePriority, toInteger(left.priority, 100))
    - toInteger(right.effectivePriority, toInteger(right.priority, 100))
    || toInteger(left.priority, 100) - toInteger(right.priority, 100)
    || String(left.providerKey || '').localeCompare(String(right.providerKey || ''))
  ));
}

export class WebSearchProviderQualityCalibrationService {
  constructor({
    db = defaultDb,
    outcomeFeedbackService = defaultOutcomeFeedbackService,
    nowFn = () => new Date(),
  } = {}) {
    this.db = db;
    this.outcomeFeedbackService = outcomeFeedbackService;
    this.nowFn = nowFn;
  }

  withDependencies(dependencies = {}) {
    return new WebSearchProviderQualityCalibrationService({
      db: dependencies.db || this.db,
      outcomeFeedbackService: dependencies.outcomeFeedbackService || this.outcomeFeedbackService,
      nowFn: dependencies.nowFn || this.nowFn,
    });
  }

  async getProviderQualityCalibrations(providerKeys = [], {
    purpose = DEFAULT_PURPOSE,
    now = this.nowFn(),
    ...options
  } = {}) {
    const normalizedProviderKeys = normalizeProviderKeys(providerKeys);
    if (normalizedProviderKeys.length === 0) return new Map();

    const config = normalizeOptions(options);
    const result = await this.db.query(
      `SELECT
          provider_key,
          COUNT(*) FILTER (WHERE operation = 'search')::integer AS total_searches,
          COUNT(*) FILTER (WHERE operation = 'search' AND status = 'success')::integer AS successful_searches,
          COUNT(*) FILTER (WHERE operation = 'search' AND status IN ('failed', 'rate_limited', 'quota_exhausted'))::integer AS failed_searches,
          COUNT(*) FILTER (WHERE operation = 'search' AND status = 'success' AND result_count > 0)::integer AS non_empty_successes,
          COUNT(*) FILTER (WHERE operation = 'search' AND status = 'success' AND result_count = 0)::integer AS zero_result_successes,
          AVG(duration_ms) FILTER (WHERE operation = 'search' AND duration_ms IS NOT NULL)::numeric AS average_duration_ms
         FROM web_search_provider_usage
        WHERE provider_key = ANY($1::varchar[])
          AND purpose = $2
          AND searched_at >= ($3::timestamptz - ($4::integer * INTERVAL '1 day'))
        GROUP BY provider_key`,
      [
        normalizedProviderKeys,
        normalizePurpose(purpose),
        now,
        config.lookbackDays,
      ]
    );
    const feedbackLookup = this.outcomeFeedbackService?.getProviderOutcomeFeedbackSummariesSafely
      || this.outcomeFeedbackService?.getProviderOutcomeFeedbackSummaries;
    const outcomeFeedbackSummaries = feedbackLookup
      ? await feedbackLookup.call(this.outcomeFeedbackService, normalizedProviderKeys, {
        purpose: normalizePurpose(purpose),
        now,
        lookbackDays: config.lookbackDays,
      })
      : new Map();

    const summaries = result.rows.reduce((map, row) => {
      const summary = normalizeSummaryRow(row);
      map.set(summary.providerKey, summary);
      return map;
    }, new Map());

    return normalizedProviderKeys.reduce((map, providerKey) => {
      const summary = summaries.get(providerKey) || { providerKey, ...EMPTY_SUMMARY };
      const feedbackSummary = outcomeFeedbackSummaries.get(providerKey) || EMPTY_PROVIDER_OUTCOME_FEEDBACK_SUMMARY;
      const mergedSummary = mergeOutcomeFeedbackSummary(summary, feedbackSummary);
      map.set(providerKey, {
        providerKey,
        summary: mergedSummary,
        calibration: calculateWebSearchProviderQuality(mergedSummary, config),
      });
      return map;
    }, new Map());
  }
}

export const webSearchProviderQualityCalibrationService = new WebSearchProviderQualityCalibrationService();
