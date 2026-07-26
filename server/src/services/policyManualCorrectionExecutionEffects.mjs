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
  classificationOutcomeService,
} from './classificationOutcomeService.mjs';
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

function buildPolicyManualCorrectionOutcomeProjection(command = {}) {
  const source = asObject(command);
  const finalOutcome = asObject(source.finalOutcome);
  const authorization = asObject(source.authorization);

  return {
    type: 'corrected',
    source: 'api_correction',
    actor: normalizeString(authorization.actorId, 128) || null,
    final_library_id: normalizeIdentifier(finalOutcome.destinationLibraryId),
    final_library_name: normalizeString(finalOutcome.destinationLibraryName, 255) || null,
  };
}

async function persistPolicyManualCorrectionFinalOutcome({
  client,
  command,
  outcomeService = classificationOutcomeService,
} = {}) {
  const source = asObject(command);
  const classificationId = normalizeIdentifier(source.currentState?.classificationId);
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Manual correction final-outcome persistence requires a transaction client.');
  }
  if (!classificationId || source.operations?.finalOutcome?.operationId !==
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.RECORD_FINAL_OUTCOME) {
    throw new TypeError('Manual correction final-outcome persistence requires an authorized operation.');
  }

  const result = await outcomeService.recordOutcome(
    classificationId,
    buildPolicyManualCorrectionOutcomeProjection(source),
    { client },
  );
  if (result?.updated !== true) {
    throw new Error('Manual correction outcome projection was not persisted.');
  }

  return {
    operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.RECORD_FINAL_OUTCOME,
    persisted: true,
    reasonId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.FINAL_OUTCOME_PERSISTED,
  };
}

export {
  buildPolicyManualCorrectionOutcomeProjection,
  persistPolicyManualCorrectionFinalOutcome,
};
