/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_INTENT_REPLAY_PARITY_DELTA_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_PARITY_DELTA_MODE = 'representative_replay_parity_delta';

const MAX_ITEMS = 25;
const MAX_REASONS = 8;
const ALLOWED_FITS = new Set(['strong', 'review', 'blocked', 'insufficient']);
const ALLOWED_OUTCOMES = new Set(['final_success', 'review_or_pending']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function boundedNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizeOutcome(value) {
  return ALLOWED_OUTCOMES.has(value) ? value : 'review_or_pending';
}

function normalizeFit(value) {
  return ALLOWED_FITS.has(value) ? value : 'insufficient';
}

function reasonList(values = []) {
  return asArray(values)
    .filter((value) => typeof value === 'string' && value.length > 0)
    .map((value) => value.slice(0, 120))
    .slice(0, MAX_REASONS);
}

function buildReasonCodes({ currentOutcome, draftFit, policyEngineFit, scoringItem }) {
  const reasons = [
    `current:${currentOutcome}`,
    `draft:${draftFit}`,
    `policy_engine:${policyEngineFit}`,
  ];

  const blockers = [
    ...reasonList(scoringItem?.exclusion_hits),
    ...reasonList(scoringItem?.missing_required),
    ...reasonList(scoringItem?.policy_engine?.blockers),
  ];

  return [...reasons, ...blockers.map((blocker) => `blocker:${blocker}`)]
    .slice(0, MAX_REASONS);
}

function classifyDelta({ currentOutcome, draftFit, policyEngineFit }) {
  if (draftFit === 'blocked' || policyEngineFit === 'blocked') {
    return {
      action: 'would_now_block',
      level: 'high',
    };
  }

  if (draftFit === 'insufficient' || policyEngineFit === 'insufficient') {
    return {
      action: 'insufficient_evidence',
      level: 'unknown',
    };
  }

  if (draftFit === 'review' || policyEngineFit === 'review') {
    return {
      action: 'would_now_review',
      level: currentOutcome === 'final_success' ? 'medium' : 'low',
    };
  }

  if (currentOutcome === 'final_success') {
    return {
      action: 'would_remain',
      level: 'low',
    };
  }

  return {
    action: 'would_now_candidate',
    level: 'medium',
  };
}

function buildDeltaItem(sample = {}, scoringItem = {}) {
  const currentOutcome = normalizeOutcome(sample.current_outcome);
  const draftFit = normalizeFit(scoringItem.draft_signal_fit);
  const policyEngineFit = normalizeFit(scoringItem.policy_engine?.policy_engine_fit);
  const delta = classifyDelta({
    currentOutcome,
    draftFit,
    policyEngineFit,
  });

  return {
    sample_id: boundedNumber(sample.sample_id),
    current_outcome: currentOutcome,
    draft_signal_fit: draftFit,
    policy_engine_fit: policyEngineFit,
    delta_action: delta.action,
    delta_level: delta.level,
    reason_codes: buildReasonCodes({
      currentOutcome,
      draftFit,
      policyEngineFit,
      scoringItem,
    }),
  };
}

function emptySummary(enabled = false) {
  return {
    schema_version: POLICY_INTENT_REPLAY_PARITY_DELTA_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_PARITY_DELTA_MODE,
    enabled,
    compared_count: 0,
    would_remain_count: 0,
    would_now_candidate_count: 0,
    would_now_review_count: 0,
    would_now_block_count: 0,
    insufficient_count: 0,
    items: [],
  };
}

export function buildPolicyIntentReplayParityDelta({ samples = [], scoring = null } = {}) {
  const scoringItems = asArray(scoring?.items);
  if (!scoring?.enabled || scoringItems.length === 0) {
    return emptySummary(false);
  }

  const scoringBySampleId = new Map(scoringItems.map((item) => [boundedNumber(item.sample_id), item]));
  const items = asArray(samples)
    .slice(0, MAX_ITEMS)
    .map((sample) => buildDeltaItem(sample, asObject(scoringBySampleId.get(boundedNumber(sample.sample_id)))))
    .filter((item) => item.sample_id > 0);

  return {
    ...emptySummary(true),
    compared_count: items.length,
    would_remain_count: items.filter((item) => item.delta_action === 'would_remain').length,
    would_now_candidate_count: items.filter((item) => item.delta_action === 'would_now_candidate').length,
    would_now_review_count: items.filter((item) => item.delta_action === 'would_now_review').length,
    would_now_block_count: items.filter((item) => item.delta_action === 'would_now_block').length,
    insufficient_count: items.filter((item) => item.delta_action === 'insufficient_evidence').length,
    items,
  };
}
