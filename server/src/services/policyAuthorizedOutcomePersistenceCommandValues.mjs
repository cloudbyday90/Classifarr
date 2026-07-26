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
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_ACTOR_TYPE_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';

const MAX_IDENTIFIER_LENGTH = 160;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = MAX_IDENTIFIER_LENGTH) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeIdentifier(value) {
  const identifier = normalizeString(String(value ?? ''), 24);
  return /^[1-9][0-9]{0,19}$/.test(identifier) ? identifier : null;
}

function normalizeSourceIds(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(sourceId => normalizeString(sourceId, 80))
    .filter(Boolean))];
}

function normalizeAuthorization(value = {}) {
  const source = asObject(value);
  const actorTypeId = normalizeString(source.actorTypeId, 40).toLowerCase();

  return {
    actorTypeId: Object.values(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_ACTOR_TYPE_IDS)
      .includes(actorTypeId)
      ? actorTypeId
      : null,
    actorId: normalizeString(source.actorId, 128) || null,
    revalidated: source.revalidated === true,
    canRecordOutcome: source.canRecordOutcome === true,
    canWriteLearning: source.canWriteLearning === true,
    authorizedSourceIds: normalizeSourceIds(source.authorizedSourceIds),
  };
}

function normalizeCurrentState(value = {}) {
  const source = asObject(value);

  return {
    classificationId: normalizeIdentifier(source.classificationId),
    sourceEventId: normalizeString(source.sourceEventId),
    destinationLibraryId: normalizeIdentifier(source.destinationLibraryId),
    destinationLibraryName: normalizeString(source.destinationLibraryName) || null,
    locked: source.locked === true,
  };
}

function buildSideEffects() {
  return {
    finalOutcomePersisted: false,
    learningMutationPerformed: false,
    profileRefreshQueued: false,
    providerLookupPerformed: false,
    providerQuotaRead: false,
    routeAttemptPerformed: false,
  };
}

function hasMatchingFinalOutcome(intake = {}, learningDecision = {}) {
  const intakeOutcome = asObject(intake.finalOutcome);
  const decisionOutcome = asObject(learningDecision.finalOutcome);

  return normalizeString(intakeOutcome.sourceId, 80) === normalizeString(decisionOutcome.sourceId, 80) &&
    normalizeString(intakeOutcome.answerOutcomeId, 80) ===
      normalizeString(decisionOutcome.answerOutcomeId, 80) &&
    normalizeIdentifier(intakeOutcome.itemId) === normalizeIdentifier(decisionOutcome.itemId) &&
    normalizeIdentifier(intakeOutcome.destinationLibraryId) ===
      normalizeIdentifier(decisionOutcome.destinationLibraryId) &&
    normalizeString(intakeOutcome.destinationLibraryName) ===
      normalizeString(decisionOutcome.destinationLibraryName) &&
    intakeOutcome.recorded === decisionOutcome.recorded;
}

function buildCompactCandidate(value = {}) {
  const candidate = asObject(value);

  return {
    key: normalizeString(candidate.key, 160) || null,
    signalType: normalizeString(candidate.signalType, 80) || null,
    destinationLibraryId: normalizeIdentifier(candidate.destinationLibraryId),
    destinationLibraryName: normalizeString(candidate.destinationLibraryName) || null,
    evidenceCount: Number.isInteger(Number(candidate.evidenceCount))
      ? Math.max(0, Math.trunc(Number(candidate.evidenceCount)))
      : 0,
  };
}

function candidateIsComplete(candidate = {}) {
  const normalized = buildCompactCandidate(candidate);

  return Boolean(
    normalized.key &&
    normalized.signalType &&
    normalized.destinationLibraryId &&
    normalized.destinationLibraryName,
  );
}

function isAuthorizationValidForSource(authorization = {}, sourceId) {
  return authorization.revalidated === true &&
    authorization.actorTypeId !== null &&
    authorization.actorId !== null &&
    authorization.authorizedSourceIds.includes(sourceId);
}

export {
  asObject,
  buildCompactCandidate,
  buildSideEffects,
  candidateIsComplete,
  hasMatchingFinalOutcome,
  isAuthorizationValidForSource,
  normalizeAuthorization,
  normalizeCurrentState,
  normalizeIdentifier,
  normalizeString,
};
