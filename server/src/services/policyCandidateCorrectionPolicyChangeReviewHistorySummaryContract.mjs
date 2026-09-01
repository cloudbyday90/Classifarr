/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordContract.mjs';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryConsistencyContract.mjs';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessReadModel,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessContract.mjs';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_VERSION =
  'policy.candidate_correction_policy_change_review_history_summary.v4';
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_CONTROL_KEY =
  'policy_change_review_history_summary';
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_PERIOD_DAYS = 30;
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_MAX_COMPLETED_PERIODS = 3;
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_COMPLETED_PERIODS = 6;

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  AVAILABLE: 'available',
});

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_ACTIVITY_IDS = Object.freeze({
  RECORDED: 'recorded',
  REVISED: 'revised',
});

const PERIOD_DURATION_MS = POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_PERIOD_DAYS *
  24 * 60 * 60 * 1000;
const PERIOD_ANCHOR_MS = Date.UTC(2020, 0, 6);
const PERIOD_IDS = Object.freeze([
  'most_recent_completed',
  'previous_completed',
  'earlier_completed',
]);
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeUtcDate(value) {
  if (typeof value !== 'string' || !UTC_DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function toUtcDate(value) {
  return value.toISOString().slice(0, 10);
}

function periodStartDate(value) {
  const timestamp = normalizeTimestamp(value);
  if (!timestamp) return null;
  const index = Math.floor((timestamp.getTime() - PERIOD_ANCHOR_MS) / PERIOD_DURATION_MS);
  return new Date(PERIOD_ANCHOR_MS + (index * PERIOD_DURATION_MS));
}

function addPeriods(periodStart, count) {
  return new Date(periodStart.getTime() + (count * PERIOD_DURATION_MS));
}

function getCompletedPeriods({ startedAt, now, maximumCompletedPeriods } = {}) {
  const collectionStartedAt = normalizeTimestamp(startedAt);
  const currentStart = periodStartDate(now);
  if (!collectionStartedAt || !currentStart || !Number.isSafeInteger(maximumCompletedPeriods) ||
      maximumCompletedPeriods < 1) {
    return Object.freeze([]);
  }

  const periods = [];
  for (let offset = 1; offset <= maximumCompletedPeriods; offset += 1) {
    const start = addPeriods(currentStart, -offset);
    if (start.getTime() < collectionStartedAt.getTime()) continue;
    periods.push(Object.freeze({ periodStart: toUtcDate(start) }));
  }
  return Object.freeze(periods);
}

/** Returns the server-owned fixed UTC period for an activity timestamp. */
export function getPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriodStart(value) {
  const start = periodStartDate(value);
  return start ? toUtcDate(start) : null;
}

/** Retains the current fixed period plus the six latest completed periods. */
export function getPolicyCandidateCorrectionPolicyChangeReviewHistoryRetentionCutoff(value) {
  const currentStart = periodStartDate(value);
  if (!currentStart) return null;
  return toUtcDate(addPeriods(
    currentStart,
    -POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_COMPLETED_PERIODS,
  ));
}

export function normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryControlRow(value) {
  const source = asPlainObject(value);
  const startedAt = normalizeTimestamp(source?.started_at ?? source?.startedAt);
  return source && startedAt ? Object.freeze({ startedAt: startedAt.toISOString() }) : null;
}

export function normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryAggregateRow(value) {
  const source = asPlainObject(value);
  const periodStart = normalizeUtcDate(source?.period_start ?? source?.periodStart);
  const decisionId = source?.decision_id ?? source?.decisionId;
  const recordedCount = normalizeNonNegativeInteger(source?.recorded_count ?? source?.recordedCount);
  const revisedCount = normalizeNonNegativeInteger(source?.revised_count ?? source?.revisedCount);
  if (!source || !periodStart || !POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS.includes(decisionId) ||
      recordedCount === null || revisedCount === null || recordedCount + revisedCount === 0) {
    return null;
  }
  return Object.freeze({ periodStart, decisionId, recordedCount, revisedCount });
}

/** Returns only whole periods that started after collection began. */
export function getPolicyCandidateCorrectionPolicyChangeReviewHistoryCompletedPeriods({
  startedAt,
  now = new Date(),
} = {}) {
  return Object.freeze(getCompletedPeriods({
    startedAt,
    now,
    maximumCompletedPeriods: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_MAX_COMPLETED_PERIODS,
  }).map((period, index) => Object.freeze({
    periodId: PERIOD_IDS[index],
    periodStart: period.periodStart,
  })));
}

/** Selects six fixed completed periods for the internal calibration-readiness check. */
export function getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationCompletedPeriods({
  startedAt,
  now = new Date(),
} = {}) {
  return getCompletedPeriods({
    startedAt,
    now,
    maximumCompletedPeriods: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_COMPLETED_PERIODS,
  });
}

function createConclusionSummary({ decisionId, aggregateRow } = {}) {
  const recordedCount = aggregateRow?.recordedCount || 0;
  const revisedCount = aggregateRow?.revisedCount || 0;
  return Object.freeze({
    decisionId,
    recordedCount,
    revisedCount,
    totalCount: recordedCount + revisedCount,
  });
}

function buildBaseReadModel({ statusId, historyAvailable, periods, calibrationPeriods } = {}) {
  const consistency = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel({ periods });
  const calibrationReadiness = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessReadModel({
    periods: calibrationPeriods,
  });
  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_VERSION,
    statusId,
    historyAvailable,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    consistency,
    calibrationReadiness,
    calibrationProtocol: buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel({
      consistency,
      calibrationReadiness,
    }),
    periods,
  });
}

/**
 * Projects only fixed completed-period activity counts. It deliberately drops
 * collection timestamps, raw period starts, identities, and unknown rows.
 */
export function buildPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryReadModel({
  control = null,
  aggregateRows = [],
  now = new Date(),
} = {}) {
  const normalizedControl = normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryControlRow(control);
  if (!normalizedControl) {
    return buildBaseReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_STATUS_IDS.COLLECTING,
      historyAvailable: false,
      periods: Object.freeze([]),
      calibrationPeriods: Object.freeze([]),
    });
  }

  const completedPeriods = getPolicyCandidateCorrectionPolicyChangeReviewHistoryCompletedPeriods({
    startedAt: normalizedControl.startedAt,
    now,
  });
  const calibrationCompletedPeriods = getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationCompletedPeriods({
    startedAt: normalizedControl.startedAt,
    now,
  });
  if (completedPeriods.length === 0) {
    return buildBaseReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_STATUS_IDS.COLLECTING,
      historyAvailable: false,
      periods: Object.freeze([]),
      calibrationPeriods: Object.freeze([]),
    });
  }

  const rowsByKey = new Map();
  for (const row of aggregateRows) {
    const normalized = normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryAggregateRow(row);
    if (normalized) rowsByKey.set(`${normalized.periodStart}:${normalized.decisionId}`, normalized);
  }

  const periods = Object.freeze(completedPeriods.map(period => Object.freeze({
    periodId: period.periodId,
    conclusionSummaries: Object.freeze(POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS.map(decisionId =>
      createConclusionSummary({
        decisionId,
        aggregateRow: rowsByKey.get(`${period.periodStart}:${decisionId}`),
      }),
    )),
  })));
  const calibrationPeriods = Object.freeze(calibrationCompletedPeriods.map(period => Object.freeze({
    conclusionSummaries: Object.freeze(POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS.map(decisionId =>
      createConclusionSummary({
        decisionId,
        aggregateRow: rowsByKey.get(`${period.periodStart}:${decisionId}`),
      }),
    )),
  })));

  return buildBaseReadModel({
    statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_STATUS_IDS.AVAILABLE,
    historyAvailable: true,
    periods,
    calibrationPeriods,
  });
}
