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
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS,
} from './policyAuthorizedOutcomeExecutionVocabulary.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

async function verifyPolicyRuntimeExactItemMemoryFinalOutcome({
  client,
  command,
  executionState,
} = {}) {
  const source = asObject(command);
  const operation = asObject(source.operations?.finalOutcome);
  const outcome = asObject(source.finalOutcome);
  const state = asObject(executionState);
  const resolution = asObject(state.resolution);

  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Runtime exact-item memory verification requires a transaction client.');
  }
  if (operation.operationId !==
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.VERIFY_RECORDED_FINAL_OUTCOME ||
      state.ok !== true ||
      resolution.finalOutcomeRecorded !== true ||
      normalizeIdentifier(outcome.itemId) !== normalizeIdentifier(state.classification?.id) ||
      normalizeIdentifier(outcome.destinationLibraryId) !== normalizeIdentifier(state.destination?.id) ||
      normalizeString(outcome.destinationLibraryName, 255) !==
        normalizeString(state.destination?.name, 255) ||
      normalizeString(source.sourceEventId, 160) !== normalizeString(resolution.sourceEventId, 160)) {
    throw new TypeError('Runtime exact-item memory requires a matching locked final outcome.');
  }

  return {
    operationId: operation.operationId,
    verified: true,
    persisted: false,
    reasonId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.FINAL_OUTCOME_VERIFIED,
  };
}

export {
  verifyPolicyRuntimeExactItemMemoryFinalOutcome,
};
