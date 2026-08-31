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
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS,
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS,
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
} from './policyCandidateCorrectionSignalSnapshot.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
} from './policyCandidateCorrectionRepresentativeReviewCorpusVocabulary.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_VERSION =
  'policy.candidate_correction_representative_review_projection.v1';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS = Object.freeze({
  CONFIGURATION_REQUIRED: 'configuration_required',
  PROJECTION_NOT_CREATED: 'projection_not_created',
  PROJECTION_AVAILABLE: 'projection_available',
});

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS = Object.freeze({
  PREVIOUS: 'previous',
  CURRENT: 'current',
});

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_AUDIT_ACTION_IDS =
  Object.freeze({
    PROJECTION_CREATED: 'projection_created',
    PROJECTION_VIEWED: 'projection_viewed',
    PROJECTION_EXPIRED: 'projection_expired',
  });

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_SAMPLE_PER_STRATUM = 5;
export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_MAX_ITEM_COUNT =
  2 * POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.length *
  Object.values(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS).length *
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_SAMPLE_PER_STRATUM;

const SNAPSHOT_ID_PATTERN = /^[a-f0-9]{64}$/u;
const REVISION_PATTERN = /^[a-f0-9]{64}$/u;
const PERIOD_IDS = new Set(Object.values(POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS));
const MARGIN_BAND_IDS = new Set(POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER);
const SELECTION_STATUS_IDS = new Set(Object.values(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS));
const EVIDENCE_SOURCE_IDS = new Set(POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS);
const EVIDENCE_STATE_IDS = new Set(POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS);

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizePositiveInteger(value, { maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 && numeric <= maximum ? numeric : null;
}

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeEvidenceSourceStates(value) {
  const source = Array.isArray(value) ? value : null;
  if (!source || source.length !== POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.length) return null;

  const statesBySource = new Map();
  for (const entry of source) {
    const sourceId = entry?.source_id ?? entry?.sourceId;
    const stateId = entry?.state_id ?? entry?.stateId;
    if (!EVIDENCE_SOURCE_IDS.has(sourceId) || !EVIDENCE_STATE_IDS.has(stateId) || statesBySource.has(sourceId)) {
      return null;
    }
    statesBySource.set(sourceId, stateId);
  }

  if (statesBySource.size !== POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.length) return null;

  return Object.freeze(POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.map(sourceId => Object.freeze({
    sourceId,
    stateId: statesBySource.get(sourceId),
  })));
}

export function normalizePolicyCandidateCorrectionRepresentativeReviewProjectionItem(row) {
  const source = asPlainObject(row);
  const ordinal = normalizePositiveInteger(source?.ordinal, {
    maximum: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_MAX_ITEM_COUNT,
  });
  const periodId = source?.period_id ?? source?.periodId;
  const scoreMarginBandId = source?.score_margin_band_id ?? source?.scoreMarginBandId;
  const selectionStatusId = source?.selection_status_id ?? source?.selectionStatusId;
  const evidenceSourceStates = normalizeEvidenceSourceStates(
    source?.evidence_source_states ?? source?.evidenceSourceStates,
  );

  if (!ordinal || !PERIOD_IDS.has(periodId) || !MARGIN_BAND_IDS.has(scoreMarginBandId) ||
      !SELECTION_STATUS_IDS.has(selectionStatusId) || !evidenceSourceStates) {
    return null;
  }

  return Object.freeze({ ordinal, periodId, scoreMarginBandId, selectionStatusId, evidenceSourceStates });
}

function normalizeProjectionWindows(row) {
  const previousStartAt = normalizeTimestamp(row?.previous_window_start_at ?? row?.previousWindowStartAt);
  const previousEndAt = normalizeTimestamp(row?.previous_window_end_at ?? row?.previousWindowEndAt);
  const currentStartAt = normalizeTimestamp(row?.current_window_start_at ?? row?.currentWindowStartAt);
  const currentEndAt = normalizeTimestamp(row?.current_window_end_at ?? row?.currentWindowEndAt);

  if (!previousStartAt || !previousEndAt || !currentStartAt || !currentEndAt ||
      previousStartAt >= previousEndAt || previousEndAt !== currentStartAt || currentStartAt >= currentEndAt) {
    return null;
  }

  return Object.freeze([
    Object.freeze({ periodId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS.PREVIOUS, startAt: previousStartAt, endAt: previousEndAt }),
    Object.freeze({ periodId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS.CURRENT, startAt: currentStartAt, endAt: currentEndAt }),
  ]);
}

export function normalizePolicyCandidateCorrectionRepresentativeReviewProjection({ snapshot, items } = {}) {
  const source = asPlainObject(snapshot);
  const snapshotId = source?.snapshot_id ?? source?.snapshotId;
  const purposeId = source?.purpose_id ?? source?.purposeId;
  const configurationRevision = source?.configuration_revision ?? source?.configurationRevision;
  const createdAt = normalizeTimestamp(source?.created_at ?? source?.createdAt);
  const expiresAt = normalizeTimestamp(source?.expires_at ?? source?.expiresAt);
  const samplePerStratum = normalizePositiveInteger(
    source?.sample_per_stratum ?? source?.samplePerStratum,
    { maximum: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_SAMPLE_PER_STRATUM },
  );
  const itemCount = Number(source?.item_count ?? source?.itemCount);
  const windows = normalizeProjectionWindows(source);
  const normalizedItems = Array.isArray(items)
    ? items.map(normalizePolicyCandidateCorrectionRepresentativeReviewProjectionItem)
    : null;

  if (!SNAPSHOT_ID_PATTERN.test(snapshotId || '') ||
      purposeId !== POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID ||
      !REVISION_PATTERN.test(configurationRevision || '') || !createdAt || !expiresAt || createdAt >= expiresAt ||
      !samplePerStratum || !Number.isSafeInteger(itemCount) || itemCount < 0 ||
      itemCount > POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_MAX_ITEM_COUNT ||
      !windows || !normalizedItems || normalizedItems.some(item => item === null) ||
      normalizedItems.length !== itemCount ||
      new Set(normalizedItems.map(item => item.ordinal)).size !== normalizedItems.length) {
    return null;
  }

  const orderedItems = normalizedItems.slice().sort((left, right) => left.ordinal - right.ordinal);
  if (!orderedItems.every((item, index) => item.ordinal === index + 1)) return null;

  return Object.freeze({
    createdAt,
    expiresAt,
    samplePerStratum,
    itemCount,
    windows,
    items: Object.freeze(orderedItems),
  });
}

export function buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel({
  configuration = null,
  projection = null,
} = {}) {
  if (!configuration) {
    return Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_VERSION,
      statusId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS.CONFIGURATION_REQUIRED,
      historicalRecordAccess: false,
      purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
      projection: null,
    });
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_VERSION,
    statusId: projection
      ? POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS.PROJECTION_AVAILABLE
      : POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS.PROJECTION_NOT_CREATED,
    historicalRecordAccess: false,
    purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
    projection,
  });
}

export {
  REVISION_PATTERN as POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_REVISION_PATTERN,
  SNAPSHOT_ID_PATTERN as POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_SNAPSHOT_ID_PATTERN,
};
