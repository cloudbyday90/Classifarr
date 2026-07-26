/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

import {
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_VERSION,
} from './policyAuthorizedOutcomeReceiptVocabulary.mjs';
import {
  asObject,
  buildCompactCandidate,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((normalized, key) => {
        normalized[key] = canonicalizeJson(value[key]);
        return normalized;
      }, {});
  }

  return value;
}

function buildRouteFingerprint(route) {
  if (route === null || route === undefined) return null;

  const source = asObject(route);
  return {
    attempted: source.attempted === true,
    succeeded: source.succeeded === true,
    missingMapping: source.missingMapping === true,
    routeId: normalizeString(String(source.routeId ?? ''), 120) || null,
    reasonCode: normalizeString(source.reasonCode, 80) || null,
  };
}

function buildPolicyAuthorizedOutcomeReceiptFingerprintPayload(command = {}) {
  const source = asObject(command);
  const currentState = asObject(source.currentState);
  const finalOutcome = asObject(source.finalOutcome);
  const operations = asObject(source.operations);
  const learning = operations.learning === null ? null : asObject(operations.learning);
  const profileRefresh = operations.profileRefresh === null
    ? null
    : asObject(operations.profileRefresh);

  return {
    version: POLICY_AUTHORIZED_OUTCOME_RECEIPT_VERSION,
    sourceId: normalizeString(source.sourceId, 80),
    sourceEventId: normalizeString(source.sourceEventId, 160),
    persistenceStatusId: normalizeString(source.statusId, 32),
    classificationId: normalizeIdentifier(currentState.classificationId),
    finalOutcome: {
      answerOutcomeId: normalizeString(finalOutcome.answerOutcomeId, 80) || null,
      itemId: normalizeIdentifier(finalOutcome.itemId),
      destinationLibraryId: normalizeIdentifier(finalOutcome.destinationLibraryId),
      status: normalizeString(finalOutcome.status, 80),
      route: buildRouteFingerprint(finalOutcome.route),
      recorded: finalOutcome.recorded === true,
    },
    operations: {
      finalOutcomeOperationId: normalizeString(operations.finalOutcome?.operationId, 80) || null,
      learning: learning ? {
        operationId: normalizeString(learning.operationId, 80) || null,
        tierId: normalizeString(learning.tierId, 40) || null,
        candidate: buildCompactCandidate(learning.candidate),
      } : null,
      profileRefresh: profileRefresh ? {
        operationId: normalizeString(profileRefresh.operationId, 80) || null,
        destinationLibraryId: normalizeIdentifier(profileRefresh.destinationLibraryId),
      } : null,
    },
  };
}

function buildPolicyAuthorizedOutcomeReceiptFingerprint(command = {}) {
  const payload = buildPolicyAuthorizedOutcomeReceiptFingerprintPayload(command);
  const serialized = JSON.stringify(canonicalizeJson(payload));

  return createHash('sha256').update(serialized, 'utf8').digest('hex');
}

export {
  buildPolicyAuthorizedOutcomeReceiptFingerprint,
  buildPolicyAuthorizedOutcomeReceiptFingerprintPayload,
  canonicalizeJson,
};
