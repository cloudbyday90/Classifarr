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
import {
  POLICY_LEARNING_EVENT_SOURCE_IDS,
} from './policyLearningGuard.mjs';

const POLICY_MANUAL_CORRECTION_EXECUTION_AUTHORIZATION_VERSION =
  'policy.manual_correction_execution_authorization.v1';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 128) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function buildPolicyManualCorrectionExecutionAuthorizationContext({
  actorId,
  authenticated = false,
} = {}) {
  return {
    version: POLICY_MANUAL_CORRECTION_EXECUTION_AUTHORIZATION_VERSION,
    actorId: normalizeString(actorId) || null,
    authenticated: authenticated === true,
  };
}

function revalidatePolicyManualCorrectionExecutionAuthorization({
  intake = {},
  authorizationContext = {},
} = {}) {
  const context = asObject(authorizationContext);
  const actorId = normalizeString(context.actorId);
  const intakeActorId = normalizeString(asObject(intake).actorId);
  const revalidated = context.version ===
      POLICY_MANUAL_CORRECTION_EXECUTION_AUTHORIZATION_VERSION &&
    context.authenticated === true &&
    Boolean(actorId) &&
    actorId === intakeActorId;

  return {
    actorTypeId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_ACTOR_TYPE_IDS.OPERATOR,
    actorId: actorId || null,
    revalidated,
    canRecordOutcome: revalidated,
    canWriteLearning: revalidated,
    authorizedSourceIds: revalidated
      ? [POLICY_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE]
      : [],
  };
}

export {
  POLICY_MANUAL_CORRECTION_EXECUTION_AUTHORIZATION_VERSION,
  buildPolicyManualCorrectionExecutionAuthorizationContext,
  revalidatePolicyManualCorrectionExecutionAuthorization,
};
