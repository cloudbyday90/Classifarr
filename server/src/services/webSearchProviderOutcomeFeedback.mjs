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

export const WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  PENDING: 'pending',
  NEUTRAL: 'neutral',
});

const DEFAULT_PURPOSE = 'classification';
const POSITIVE_STATUSES = new Set(['completed', 'routed', 'verified', 'reclassified']);
const NEGATIVE_STATUSES = new Set(['corrected', 'failed']);
const PENDING_STATUSES = new Set(['awaiting_decision', 'pending', 'pending_retry', 'processing']);
const POSITIVE_LINKED_OUTCOMES = new Set(['verified', 'resolved']);
const NEGATIVE_LINKED_OUTCOMES = new Set(['corrected']);

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export function classifyWebSearchProviderOutcomeFeedback({
  classificationStatus = null,
  latestOutcomeType = null,
} = {}) {
  const normalizedOutcome = String(latestOutcomeType || '').trim().toLowerCase();
  if (NEGATIVE_LINKED_OUTCOMES.has(normalizedOutcome)) {
    return WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.NEGATIVE;
  }
  if (POSITIVE_LINKED_OUTCOMES.has(normalizedOutcome)) {
    return WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.POSITIVE;
  }

  const normalizedStatus = String(classificationStatus || '').trim().toLowerCase();
  if (NEGATIVE_STATUSES.has(normalizedStatus)) {
    return WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.NEGATIVE;
  }
  if (POSITIVE_STATUSES.has(normalizedStatus)) {
    return WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.POSITIVE;
  }
  if (PENDING_STATUSES.has(normalizedStatus)) {
    return WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.PENDING;
  }
  return WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.NEUTRAL;
}

function normalizeOutcomeFeedbackSummaryRow(row = {}) {
  return {
    providerKey: row.provider_key,
    positiveOutcomes: toInteger(row.positive_outcomes),
    negativeOutcomes: toInteger(row.negative_outcomes),
    pendingOutcomes: toInteger(row.pending_outcomes),
    neutralOutcomes: toInteger(row.neutral_outcomes),
    outcomeSignalCount: toInteger(row.outcome_signal_count),
  };
}

export const EMPTY_PROVIDER_OUTCOME_FEEDBACK_SUMMARY = Object.freeze({
  positiveOutcomes: 0,
  negativeOutcomes: 0,
  pendingOutcomes: 0,
  neutralOutcomes: 0,
  outcomeSignalCount: 0,
});

export class WebSearchProviderOutcomeFeedbackService {
  constructor({ db = defaultDb } = {}) {
    this.db = db;
  }

  withDb(db) {
    return new WebSearchProviderOutcomeFeedbackService({ db });
  }

  async getProviderOutcomeFeedbackSummaries(providerKeys = [], {
    purpose = DEFAULT_PURPOSE,
    now = new Date(),
    lookbackDays = 14,
  } = {}) {
    const normalizedProviderKeys = normalizeProviderKeys(providerKeys);
    if (normalizedProviderKeys.length === 0) return new Map();

    const result = await this.db.query(
      `WITH latest_provider_classifications AS (
          SELECT DISTINCT ON (
            rd.classification_id,
            COALESCE(rd.final_provider_key, rd.selected_provider_key)
          )
            COALESCE(rd.final_provider_key, rd.selected_provider_key) AS provider_key,
            ch.status AS classification_status,
            NULLIF(ch.metadata->'classification_details'->'outcome_path'->>'latest_type', '') AS latest_outcome_type
          FROM web_search_provider_route_decisions rd
          JOIN classification_history ch ON ch.id = rd.classification_id
         WHERE COALESCE(rd.final_provider_key, rd.selected_provider_key) = ANY($1::varchar[])
           AND rd.purpose = $2
           AND rd.operation = 'search'
           AND rd.outcome = 'success'
           AND rd.classification_id IS NOT NULL
           AND rd.created_at >= ($3::timestamptz - ($4::integer * INTERVAL '1 day'))
         ORDER BY
           rd.classification_id,
           COALESCE(rd.final_provider_key, rd.selected_provider_key),
           rd.completed_at DESC NULLS LAST,
           rd.id DESC
       ), classified_feedback AS (
          SELECT
            provider_key,
            CASE
              WHEN lower(COALESCE(latest_outcome_type, '')) IN ('corrected') THEN 'negative'
              WHEN lower(COALESCE(latest_outcome_type, '')) IN ('verified', 'resolved') THEN 'positive'
              WHEN lower(COALESCE(classification_status, '')) IN ('corrected', 'failed') THEN 'negative'
              WHEN lower(COALESCE(classification_status, '')) IN ('completed', 'routed', 'verified', 'reclassified') THEN 'positive'
              WHEN lower(COALESCE(classification_status, '')) IN ('awaiting_decision', 'pending', 'pending_retry', 'processing') THEN 'pending'
              ELSE 'neutral'
            END AS feedback_signal
          FROM latest_provider_classifications
       )
       SELECT
          provider_key,
          COUNT(*) FILTER (WHERE feedback_signal = 'positive')::integer AS positive_outcomes,
          COUNT(*) FILTER (WHERE feedback_signal = 'negative')::integer AS negative_outcomes,
          COUNT(*) FILTER (WHERE feedback_signal = 'pending')::integer AS pending_outcomes,
          COUNT(*) FILTER (WHERE feedback_signal = 'neutral')::integer AS neutral_outcomes,
          COUNT(*) FILTER (WHERE feedback_signal IN ('positive', 'negative'))::integer AS outcome_signal_count
         FROM classified_feedback
        GROUP BY provider_key`,
      [
        normalizedProviderKeys,
        normalizePurpose(purpose),
        now,
        Math.max(1, Math.min(toInteger(lookbackDays, 14), 90)),
      ]
    );

    return result.rows.reduce((summaries, row) => {
      const summary = normalizeOutcomeFeedbackSummaryRow(row);
      summaries.set(summary.providerKey, summary);
      return summaries;
    }, new Map());
  }

  async getProviderOutcomeFeedbackSummariesSafely(providerKeys = [], options = {}) {
    try {
      return await this.getProviderOutcomeFeedbackSummaries(providerKeys, options);
    } catch {
      return new Map();
    }
  }
}

export const webSearchProviderOutcomeFeedbackService = new WebSearchProviderOutcomeFeedbackService();
