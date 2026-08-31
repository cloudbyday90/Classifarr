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
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_VERSION,
} from './policyCandidateCorrectionRepresentativeReviewProjectionContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
} from './policyCandidateCorrectionRepresentativeReviewCorpusVocabulary.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_VERSION =
  'policy.candidate_correction_representative_review_evaluation_report.v1';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_STATUS_IDS = Object.freeze({
  CONFIGURATION_REQUIRED: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS.CONFIGURATION_REQUIRED,
  PROJECTION_NOT_CREATED: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS.PROJECTION_NOT_CREATED,
  REPORT_AVAILABLE: 'report_available',
});

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_CONFIDENCE_LEVEL = 0.95;
export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_WILSON_Z = 1.959963984540054;

const PERIOD_IDS = Object.freeze([
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS.PREVIOUS,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS.CURRENT,
]);
const SELECTION_STATUS_IDS = Object.freeze(Object.values(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS));
const CONFIRMED_CANDIDATE_ID = POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CONFIRMED_CANDIDATE;

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function isValidTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isValidEvidenceSourceStates(value) {
  if (!Array.isArray(value) || value.length !== POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.length) {
    return false;
  }
  const stateBySource = new Map();
  for (const entry of value) {
    if (!POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.includes(entry?.sourceId) ||
        !POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS.includes(entry?.stateId) ||
        stateBySource.has(entry.sourceId)) {
      return false;
    }
    stateBySource.set(entry.sourceId, entry.stateId);
  }
  return stateBySource.size === POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.length;
}

function isValidProjection(projection) {
  if (!projection || !Number.isSafeInteger(projection.itemCount) ||
      projection.itemCount < 0 || projection.itemCount > 160 ||
      !isValidTimestamp(projection.createdAt) || !isValidTimestamp(projection.expiresAt) ||
      projection.createdAt >= projection.expiresAt || !Array.isArray(projection.windows) ||
      projection.windows.length !== PERIOD_IDS.length || !Array.isArray(projection.items) ||
      projection.items.length !== projection.itemCount) {
    return false;
  }
  const windowsAreValid = projection.windows.every((window, index) => (
    window?.periodId === PERIOD_IDS[index] && isValidTimestamp(window.startAt) &&
    isValidTimestamp(window.endAt) && window.startAt < window.endAt
  ));
  if (!windowsAreValid || projection.windows[0].endAt !== projection.windows[1].startAt) return false;

  const ordinals = new Set();
  return projection.items.every(item => {
    const validItem = Number.isSafeInteger(item?.ordinal) && item.ordinal > 0 && item.ordinal <= 160 &&
      PERIOD_IDS.includes(item.periodId) &&
      POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.includes(item.scoreMarginBandId) &&
      SELECTION_STATUS_IDS.includes(item.selectionStatusId) &&
      isValidEvidenceSourceStates(item.evidenceSourceStates);
    if (validItem) ordinals.add(item.ordinal);
    return validItem;
  }) && ordinals.size === projection.items.length;
}

function buildOutcomeCounts(items) {
  return Object.freeze(SELECTION_STATUS_IDS.map(selectionStatusId => Object.freeze({
    selectionStatusId,
    itemCount: items.filter(item => item.selectionStatusId === selectionStatusId).length,
  })));
}

/**
 * Returns a two-sided Wilson interval for a binomial proportion. This is an
 * uncertainty description for the fixed snapshot sample, not a significance
 * test and never an instruction to alter policy behavior.
 */
export function buildPolicyCandidateCorrectionRepresentativeReviewWilsonInterval({
  successfulCount,
  totalCount,
  z = POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_WILSON_Z,
} = {}) {
  if (!Number.isSafeInteger(successfulCount) || !Number.isSafeInteger(totalCount) ||
      successfulCount < 0 || totalCount <= 0 || successfulCount > totalCount ||
      !Number.isFinite(z) || z <= 0) {
    return null;
  }

  const proportion = successfulCount / totalCount;
  const zSquared = z ** 2;
  const denominator = 1 + (zSquared / totalCount);
  const center = (proportion + (zSquared / (2 * totalCount))) / denominator;
  const margin = (z / denominator) * Math.sqrt(
    (proportion * (1 - proportion) / totalCount) + (zSquared / (4 * totalCount ** 2)),
  );

  return Object.freeze({
    lowerBound: Math.max(0, center - margin),
    upperBound: Math.min(1, center + margin),
  });
}

function buildSummary({ items, dimensions }) {
  const itemCount = items.length;
  const confirmedCandidateCount = items.filter(
    item => item.selectionStatusId === CONFIRMED_CANDIDATE_ID,
  ).length;

  return Object.freeze({
    ...dimensions,
    itemCount,
    confirmedCandidateCount,
    confirmationRate: itemCount > 0 ? confirmedCandidateCount / itemCount : null,
    confirmationRateInterval95: buildPolicyCandidateCorrectionRepresentativeReviewWilsonInterval({
      successfulCount: confirmedCandidateCount,
      totalCount: itemCount,
    }),
    selectionOutcomeCounts: buildOutcomeCounts(items),
  });
}

function filterByPeriod(items, periodId) {
  return items.filter(item => item.periodId === periodId);
}

function buildPeriodSummaries(items) {
  return Object.freeze(PERIOD_IDS.map(periodId => buildSummary({
    items: filterByPeriod(items, periodId),
    dimensions: { periodId },
  })));
}

function buildMarginSummaries(items) {
  return Object.freeze(PERIOD_IDS.flatMap(periodId => (
    POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.map(scoreMarginBandId => buildSummary({
      items: items.filter(item => (
        item.periodId === periodId && item.scoreMarginBandId === scoreMarginBandId
      )),
      dimensions: { periodId, scoreMarginBandId },
    }))
  )));
}

function buildEvidenceStateSummaries(items) {
  return Object.freeze(PERIOD_IDS.flatMap(periodId => (
    POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.flatMap(sourceId => (
      POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS.map(stateId => buildSummary({
        items: items.filter(item => (
          item.periodId === periodId && item.evidenceSourceStates.some(entry => (
            entry.sourceId === sourceId && entry.stateId === stateId
          ))
        )),
        dimensions: { periodId, sourceId, stateId },
      }))
    ))
  )));
}

function buildDescriptiveComparison(periodSummaries) {
  const previous = periodSummaries.find(
    summary => summary.periodId === POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS.PREVIOUS,
  );
  const current = periodSummaries.find(
    summary => summary.periodId === POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_PERIOD_IDS.CURRENT,
  );

  return Object.freeze({
    comparisonType: 'descriptive_only',
    confirmationRatePointDifference: previous?.confirmationRate !== null && current?.confirmationRate !== null
      ? current.confirmationRate - previous.confirmationRate
      : null,
    message: 'This comparison describes the fixed redacted sample. It is not a significance test and cannot authorize policy, AI, RAG, learning, retry, or routing changes.',
  });
}

function buildEvaluationReport(projection) {
  const items = projection.items;
  const periodSummaries = buildPeriodSummaries(items);

  return Object.freeze({
    createdAt: projection.createdAt,
    expiresAt: projection.expiresAt,
    itemCount: projection.itemCount,
    windows: Object.freeze(projection.windows.map(window => Object.freeze({
      periodId: window.periodId,
      startAt: window.startAt,
      endAt: window.endAt,
    }))),
    confidenceLevel: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_CONFIDENCE_LEVEL,
    periodSummaries,
    marginSummaries: buildMarginSummaries(items),
    evidenceStateSummaries: buildEvidenceStateSummaries(items),
    comparison: buildDescriptiveComparison(periodSummaries),
  });
}

/**
 * Rebuilds a strict aggregate-only report from the existing read model. The
 * individual sample rows stay within the projection service and never cross
 * this report boundary.
 */
export function buildPolicyCandidateCorrectionRepresentativeReviewEvaluationReportReadModel({
  projectionReadModel,
} = {}) {
  const source = asPlainObject(projectionReadModel);
  const statusId = source?.statusId;
  const projection = asPlainObject(source?.projection);

  if (source?.version !== POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_VERSION ||
      source?.purposeId !== POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID ||
      source?.historicalRecordAccess !== false) {
    throw new TypeError('Review projection read model is invalid.');
  }

  if (statusId === POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS.CONFIGURATION_REQUIRED ||
      statusId === POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS.PROJECTION_NOT_CREATED) {
    return Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_VERSION,
      statusId,
      historicalRecordAccess: false,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
      report: null,
    });
  }

  if (statusId !== POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_STATUS_IDS.PROJECTION_AVAILABLE ||
      !isValidProjection(projection)) {
    throw new TypeError('Review projection report source is invalid.');
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_VERSION,
    statusId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_STATUS_IDS.REPORT_AVAILABLE,
    historicalRecordAccess: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
    report: buildEvaluationReport(projection),
  });
}
