/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_VERSION =
  'policy.candidate_correction_policy_change_outcome_observation.v1';
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_CONTROL_KEY =
  'policy_change_outcome_observation';
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_WINDOW_DAYS = 28;
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_READABLE_DAYS = 30;

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_STATUS_IDS = Object.freeze({
  NOT_STARTED: 'not_started',
  OBSERVING: 'observing',
  OUTCOME_AVAILABLE: 'outcome_available',
  EXPIRED: 'expired',
});

const HYPOTHESIS_ID_PATTERN = /^pco_[A-Za-z0-9_-]{32}$/u;
const WILSON_Z = 1.959963984540054;

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeNonnegativeInteger(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function buildWilsonInterval(successfulCount, totalCount) {
  if (!totalCount) return null;
  const proportion = successfulCount / totalCount;
  const zSquared = WILSON_Z ** 2;
  const denominator = 1 + (zSquared / totalCount);
  const center = (proportion + (zSquared / (2 * totalCount))) / denominator;
  const margin = (WILSON_Z / denominator) * Math.sqrt(
    (proportion * (1 - proportion) / totalCount) + (zSquared / (4 * totalCount ** 2)),
  );
  return Object.freeze({
    lowerBound: Math.max(0, center - margin),
    upperBound: Math.min(1, center + margin),
  });
}

function startOfUtcDay(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  return new Date(Date.UTC(
    timestamp.getUTCFullYear(),
    timestamp.getUTCMonth(),
    timestamp.getUTCDate(),
  ));
}

function addUtcDays(value, days) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function normalizeSummary(value) {
  const source = asPlainObject(value);
  const outcomeCount = normalizeNonnegativeInteger(source?.outcomeCount ?? source?.outcome_count);
  const confirmedLeaderOutcomeCount = normalizeNonnegativeInteger(
    source?.confirmedLeaderOutcomeCount ?? source?.confirmed_leader_outcome_count,
  );
  const changedToCandidateOutcomeCount = normalizeNonnegativeInteger(
    source?.changedToCandidateOutcomeCount ?? source?.changed_to_candidate_outcome_count,
  );
  const changedOutsideCandidatesOutcomeCount = normalizeNonnegativeInteger(
    source?.changedOutsideCandidatesOutcomeCount ?? source?.changed_outside_candidates_outcome_count,
  );
  const routedNotApplicableOutcomeCount = normalizeNonnegativeInteger(
    source?.routedNotApplicableOutcomeCount ?? source?.routed_not_applicable_outcome_count,
  );

  if ([
    outcomeCount,
    confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount,
  ].some(count => count === null)) {
    return null;
  }

  const classifiedCount = confirmedLeaderOutcomeCount + changedToCandidateOutcomeCount +
    changedOutsideCandidatesOutcomeCount + routedNotApplicableOutcomeCount;
  if (classifiedCount !== outcomeCount) return null;

  const applicableDecisionCount = confirmedLeaderOutcomeCount + changedToCandidateOutcomeCount +
    changedOutsideCandidatesOutcomeCount;
  const changedSelectionOutcomeCount = changedToCandidateOutcomeCount + changedOutsideCandidatesOutcomeCount;
  return Object.freeze({
    outcomeCount,
    confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount,
    applicableDecisionCount,
    changedSelectionOutcomeCount,
    changedSelectionRatePercent: applicableDecisionCount > 0
      ? Math.round((changedSelectionOutcomeCount / applicableDecisionCount) * 1000) / 10
      : 0,
    changedSelectionRateInterval95: buildWilsonInterval(
      changedSelectionOutcomeCount,
      applicableDecisionCount,
    ),
  });
}

function normalizeWindow({ startAt, endAt } = {}) {
  const normalizedStartAt = normalizeTimestamp(startAt);
  const normalizedEndAt = normalizeTimestamp(endAt);
  if (!normalizedStartAt || !normalizedEndAt || normalizedStartAt >= normalizedEndAt) return null;
  return Object.freeze({ startAt: normalizedStartAt, endAt: normalizedEndAt });
}

function normalizeObservationRow(value) {
  const row = asPlainObject(value);
  const hypothesisId = row?.hypothesis_id ?? row?.hypothesisId;
  const sourceIntentVersion = Number(row?.source_intent_version ?? row?.sourceIntentVersion);
  const targetIntentVersion = Number(row?.target_intent_version ?? row?.targetIntentVersion);
  const createdAt = normalizeTimestamp(row?.created_at ?? row?.createdAt);
  const expiresAt = normalizeTimestamp(row?.expires_at ?? row?.expiresAt);
  const baselineWindow = normalizeWindow({
    startAt: row?.baseline_window_start_at ?? row?.baselineWindowStartAt ?? row?.baselineWindow?.startAt,
    endAt: row?.baseline_window_end_at ?? row?.baselineWindowEndAt ?? row?.baselineWindow?.endAt,
  });
  const followupWindow = normalizeWindow({
    startAt: row?.followup_window_start_at ?? row?.followupWindowStartAt ?? row?.followupWindow?.startAt,
    endAt: row?.followup_window_end_at ?? row?.followupWindowEndAt ?? row?.followupWindow?.endAt,
  });
  const baselineSummary = normalizeSummary(row?.baselineSummary ?? row);

  if (!HYPOTHESIS_ID_PATTERN.test(hypothesisId || '') ||
      !Number.isSafeInteger(sourceIntentVersion) || sourceIntentVersion <= 0 ||
      !Number.isSafeInteger(targetIntentVersion) || targetIntentVersion <= sourceIntentVersion ||
      !createdAt || !expiresAt || createdAt >= expiresAt || !baselineWindow || !followupWindow ||
      !baselineSummary || baselineWindow.endAt > followupWindow.startAt ||
      followupWindow.endAt > expiresAt) {
    return null;
  }

  return Object.freeze({
    hypothesisId,
    sourceIntentVersion,
    targetIntentVersion,
    createdAt,
    expiresAt,
    baselineWindow,
    followupWindow,
    baselineSummary,
  });
}

export function buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationWindows({ now = new Date() } = {}) {
  const currentDayStart = startOfUtcDay(now);
  if (!currentDayStart) throw new TypeError('A valid observation time is required.');

  const baselineEnd = currentDayStart;
  const baselineStart = addUtcDays(baselineEnd,
    -POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_WINDOW_DAYS);
  const followupStart = addUtcDays(currentDayStart, 1);
  const followupEnd = addUtcDays(
    followupStart,
    POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_WINDOW_DAYS,
  );
  const expiresAt = addUtcDays(
    followupEnd,
    POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_READABLE_DAYS,
  );

  return Object.freeze({
    baselineWindow: Object.freeze({
      days: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_WINDOW_DAYS,
      start: baselineStart,
      end: baselineEnd,
    }),
    followupWindow: Object.freeze({
      days: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_WINDOW_DAYS,
      start: followupStart,
      end: followupEnd,
    }),
    expiresAt,
  });
}

export function buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel({
  observation = null,
  now = new Date(),
  startAvailable = false,
  followupSummary = null,
} = {}) {
  const observedAt = normalizeTimestamp(now);
  if (!observedAt) throw new TypeError('A valid observation time is required.');
  const normalizedObservation = observation ? normalizeObservationRow(observation) : null;

  if (!normalizedObservation) {
    return Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_VERSION,
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_STATUS_IDS.NOT_STARTED,
      startAvailable: startAvailable === true,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
      observation: null,
      outcome: null,
    });
  }

  if (normalizedObservation.expiresAt <= observedAt) {
    return Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_VERSION,
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_STATUS_IDS.EXPIRED,
      startAvailable: startAvailable === true,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
      observation: null,
      outcome: null,
    });
  }

  const observationReadModel = Object.freeze({
    hypothesisId: normalizedObservation.hypothesisId,
    baselineWindow: normalizedObservation.baselineWindow,
    followupWindow: normalizedObservation.followupWindow,
    createdAt: normalizedObservation.createdAt,
    outcomeAvailableAt: normalizedObservation.followupWindow.endAt,
    expiresAt: normalizedObservation.expiresAt,
    baselineSummary: normalizedObservation.baselineSummary,
  });

  if (normalizedObservation.followupWindow.endAt > observedAt) {
    return Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_VERSION,
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_STATUS_IDS.OBSERVING,
      startAvailable: false,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
      observation: observationReadModel,
      outcome: null,
    });
  }

  const normalizedFollowupSummary = normalizeSummary(followupSummary);
  if (!normalizedFollowupSummary) throw new TypeError('Follow-up outcome summary is invalid.');
  const changedSelectionRatePointDifference = Math.round(
    (normalizedFollowupSummary.changedSelectionRatePercent -
      normalizedObservation.baselineSummary.changedSelectionRatePercent) * 10,
  ) / 10;

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_VERSION,
    statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_STATUS_IDS.OUTCOME_AVAILABLE,
    startAvailable: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    observation: observationReadModel,
    outcome: Object.freeze({
      followupSummary: normalizedFollowupSummary,
      changedSelectionRatePointDifference,
      comparisonType: 'descriptive_only',
      message: 'This fixed aggregate comparison is descriptive only. It cannot change policy, AI, RAG, learning, retry, or routing.',
    }),
  });
}

export function normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow(value) {
  return normalizeObservationRow(value);
}

export function normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationSummary(value) {
  return normalizeSummary(value);
}
