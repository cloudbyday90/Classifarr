/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_FINAL_OUTCOME_VERSION = 'policy.final_outcome.v1';
const MAX_FINAL_OUTCOME_TEXT_LENGTH = 160;
const MAX_FINAL_OUTCOME_IDENTIFIER_LENGTH = 120;

const POLICY_FINAL_OUTCOME_STATUS_IDS = Object.freeze({
  RESOLVED: 'resolved',
  ROUTED: 'routed',
  ROUTE_FAILED_MISSING_MAPPING: 'route_failed_missing_mapping',
});

const POLICY_FINAL_OUTCOME_REASON_IDS = Object.freeze({
  RECORDED: 'final_outcome_recorded',
});

const POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_final_outcome_version',
  INVALID_RECORDED_STATE: 'invalid_final_outcome_recorded_state',
  INVALID_SOURCE: 'invalid_final_outcome_source',
  INVALID_STATUS: 'invalid_final_outcome_status',
  INVALID_ROUTE: 'invalid_final_outcome_route',
  LEARNING_FIELD_PRESENT: 'final_outcome_contains_learning_field',
  WRITE_FIELD_PRESENT: 'final_outcome_contains_write_field',
});

const ROUTE_REASON_IDS = Object.freeze([
  'missing_mapping',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = MAX_FINAL_OUTCOME_TEXT_LENGTH) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeIdentifier(value) {
  if (Number.isInteger(value) && value >= 0) return value;

  const normalized = normalizeString(value, MAX_FINAL_OUTCOME_IDENTIFIER_LENGTH);
  return normalized || null;
}

function normalizeOutcomeStatus(value) {
  const statusId = normalizeString(value, 80);
  return Object.values(POLICY_FINAL_OUTCOME_STATUS_IDS).includes(statusId)
    ? statusId
    : POLICY_FINAL_OUTCOME_STATUS_IDS.RESOLVED;
}

function normalizeRoute(route) {
  if (route === undefined || route === null) return null;

  const source = asObject(route);
  const reasonCode = normalizeString(source.reasonCode, 80);

  return {
    attempted: source.attempted === true,
    succeeded: source.succeeded === true,
    missingMapping: source.missingMapping === true,
    routeId: normalizeIdentifier(source.routeId),
    reasonCode: ROUTE_REASON_IDS.includes(reasonCode) ? reasonCode : null,
  };
}

function buildPolicyFinalOutcome({
  sourceId,
  answerOutcomeId = null,
  itemId = null,
  destinationLibraryId = null,
  destinationLibraryName = null,
  status = POLICY_FINAL_OUTCOME_STATUS_IDS.RESOLVED,
  route,
  recorded = true,
} = {}) {
  return {
    version: POLICY_FINAL_OUTCOME_VERSION,
    recorded: recorded === true,
    sourceId: normalizeString(sourceId, 80) || null,
    answerOutcomeId: normalizeString(answerOutcomeId, 80) || null,
    itemId: normalizeIdentifier(itemId),
    destinationLibraryId: normalizeIdentifier(destinationLibraryId),
    destinationLibraryName: normalizeString(destinationLibraryName) || null,
    status: normalizeOutcomeStatus(status),
    route: normalizeRoute(route),
    reasonCodes: [POLICY_FINAL_OUTCOME_REASON_IDS.RECORDED],
  };
}

function buildPolicyFinalOutcomeAudit(outcome = {}) {
  const source = asObject(outcome);
  const issues = [];
  const route = source.route === null ? null : asObject(source.route);

  if (source.version !== POLICY_FINAL_OUTCOME_VERSION) {
    issues.push({
      riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Final outcome must use the current final-outcome contract version.',
    });
  }

  if (source.recorded !== true && source.recorded !== false) {
    issues.push({
      riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.INVALID_RECORDED_STATE,
      message: 'Final outcome must declare whether it was recorded.',
    });
  }

  if (!normalizeString(source.sourceId, 80)) {
    issues.push({
      riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.INVALID_SOURCE,
      message: 'Final outcome requires a bounded source identifier.',
    });
  }

  if (!Object.values(POLICY_FINAL_OUTCOME_STATUS_IDS).includes(source.status)) {
    issues.push({
      riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Final outcome must use an allowlisted status.',
    });
  }

  if (source.status === POLICY_FINAL_OUTCOME_STATUS_IDS.ROUTED &&
      (!route || route.attempted !== true || route.succeeded !== true || route.missingMapping === true)) {
    issues.push({
      riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.INVALID_ROUTE,
      message: 'Routed final outcomes require a successful route summary.',
    });
  }

  if (source.status === POLICY_FINAL_OUTCOME_STATUS_IDS.ROUTE_FAILED_MISSING_MAPPING &&
      (!route || route.attempted !== true || route.succeeded === true || route.missingMapping !== true)) {
    issues.push({
      riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.INVALID_ROUTE,
      message: 'Missing-mapping final outcomes require a failed route summary.',
    });
  }

  if (['learning', 'candidate', 'tierId', 'profileRefresh'].some(key => Object.hasOwn(source, key))) {
    issues.push({
      riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.LEARNING_FIELD_PRESENT,
      message: 'Final outcomes must not embed learning eligibility or candidates.',
    });
  }

  if (['writesPerformed', 'learningWritten', 'policyStorageMutated', 'routingAttempted'].some(key => Object.hasOwn(source, key))) {
    issues.push({
      riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.WRITE_FIELD_PRESENT,
      message: 'Final outcomes must not claim policy, learning, or routing writes.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS,
  POLICY_FINAL_OUTCOME_REASON_IDS,
  POLICY_FINAL_OUTCOME_STATUS_IDS,
  POLICY_FINAL_OUTCOME_VERSION,
  buildPolicyFinalOutcome,
  buildPolicyFinalOutcomeAudit,
};
