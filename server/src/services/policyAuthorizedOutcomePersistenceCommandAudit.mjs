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
  buildPolicyFinalOutcomeAudit,
} from './policyFinalOutcomeNormalizer.mjs';
import {
  LEARNING_OPERATION_BY_TIER,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_COMMAND_VERSION,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  asObject,
  candidateIsComplete,
  isAuthorizationValidForSource,
  normalizeAuthorization,
  normalizeCurrentState,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

function buildPolicyAuthorizedOutcomePersistenceCommandAudit(command = {}) {
  const source = asObject(command);
  const authorization = normalizeAuthorization(source.authorization);
  const currentState = normalizeCurrentState(source.currentState);
  const finalOutcome = asObject(source.finalOutcome);
  const operations = asObject(source.operations);
  const finalOutcomeOperation = asObject(operations.finalOutcome);
  const learningOperation = operations.learning === null ? null : asObject(operations.learning);
  const profileRefreshOperation = operations.profileRefresh === null ? null : asObject(operations.profileRefresh);
  const sideEffects = asObject(source.sideEffects);
  const issues = [];

  if (source.version !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_COMMAND_VERSION) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Authorized persistence commands must use the current contract version.',
    });
  }
  if (!Object.values(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS).includes(source.statusId)) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Authorized persistence commands must use a supported status.',
    });
  }
  if (buildPolicyFinalOutcomeAudit(finalOutcome).ok !== true) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.INVALID_FINAL_OUTCOME,
      message: 'Authorized persistence commands require a valid final outcome.',
    });
  }

  if (source.statusId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.BLOCKED &&
      finalOutcomeOperation.operationId !==
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.RECORD_FINAL_OUTCOME) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.MISSING_OUTCOME_OPERATION,
      message: 'An admitted command must include a final-outcome operation.',
    });
  }

  if (source.statusId === POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.READY) {
    const expectedOperationId = LEARNING_OPERATION_BY_TIER[learningOperation?.tierId] || null;
    if (!expectedOperationId || learningOperation.operationId !== expectedOperationId ||
        !candidateIsComplete(learningOperation.candidate)) {
      issues.push({
        riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.INVALID_READY_LEARNING_OPERATION,
        message: 'Ready commands require a complete allowlisted learning operation.',
      });
    }
    if (authorization.canWriteLearning !== true) {
      issues.push({
        riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.UNAUTHORIZED_LEARNING_OPERATION,
        message: 'Ready commands require revalidated learning-write authority.',
      });
    }
    if (normalizeIdentifier(learningOperation?.candidate?.destinationLibraryId) !==
          normalizeIdentifier(finalOutcome.destinationLibraryId) ||
        normalizeString(learningOperation?.candidate?.destinationLibraryName) !==
          normalizeString(finalOutcome.destinationLibraryName)) {
      issues.push({
        riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.LEARNING_DESTINATION_MISMATCH,
        message: 'Ready commands require learning evidence for the final-outcome destination.',
      });
    }
  }

  if (source.statusId === POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.OUTCOME_ONLY &&
      (learningOperation || profileRefreshOperation)) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.OUTCOME_ONLY_HAS_LEARNING_OPERATION,
      message: 'Outcome-only commands cannot carry learning or profile-refresh operations.',
    });
  }

  if (source.statusId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.BLOCKED &&
      (!isAuthorizationValidForSource(authorization, source.sourceId) ||
        authorization.canRecordOutcome !== true)) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.UNAUTHORIZED_OUTCOME_OPERATION,
      message: 'Admitted commands require revalidated outcome authority for the source.',
    });
  }

  if (source.statusId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.BLOCKED &&
      (currentState.locked !== true ||
        currentState.sourceEventId !== source.sourceEventId ||
        currentState.classificationId !== normalizeIdentifier(finalOutcome.itemId) ||
        currentState.destinationLibraryId !== normalizeIdentifier(finalOutcome.destinationLibraryId) ||
        currentState.destinationLibraryName !== normalizeString(finalOutcome.destinationLibraryName))) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.CURRENT_STATE_MISMATCH,
      message: 'Admitted commands require a matching transaction-locked current state.',
    });
  }

  if (source.statusId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.BLOCKED &&
      finalOutcomeOperation.sourceEventId !== source.sourceEventId) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.SOURCE_EVENT_MISMATCH,
      message: 'Final-outcome operations must retain the command source-event identifier.',
    });
  }

  const prohibitedSideEffect = [
    'finalOutcomePersisted',
    'learningMutationPerformed',
    'profileRefreshQueued',
    'providerLookupPerformed',
    'providerQuotaRead',
    'routeAttemptPerformed',
  ].find(sideEffectId => sideEffects[sideEffectId] === true);
  if (prohibitedSideEffect) {
    issues.push({
      riskId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      message: 'Authorized persistence commands must remain pure plans.',
      sideEffectId: prohibitedSideEffect,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  buildPolicyAuthorizedOutcomePersistenceCommandAudit,
};
