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
  classificationEvidenceService,
} from './classificationEvidenceService.mjs';
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

function buildPolicyAuthorizedOutcomeProjection(command = {}) {
  const source = asObject(command);
  const finalOutcome = asObject(source.finalOutcome);
  const authorization = asObject(source.authorization);
  const route = finalOutcome.route === null ? null : asObject(finalOutcome.route);

  return {
    type: normalizeString(finalOutcome.status, 80) || null,
    source: normalizeString(source.sourceId, 80) || null,
    actor: normalizeString(authorization.actorId, 128) || null,
    final_library_id: normalizeIdentifier(finalOutcome.destinationLibraryId),
    final_library_name: normalizeString(finalOutcome.destinationLibraryName, 255) || null,
    routing: route ? {
      attempted: route.attempted === true,
      succeeded: route.succeeded === true,
      missing_mapping: route.missingMapping === true,
      route_id: normalizeIdentifier(route.routeId),
      reason_code: normalizeString(route.reasonCode, 80) || null,
    } : null,
  };
}

async function persistPolicyAuthorizedFinalOutcome({
  client,
  command,
  outcomeService = classificationOutcomeService,
} = {}) {
  const source = asObject(command);
  const classificationId = normalizeIdentifier(source.currentState?.classificationId);
  const operationId = source.operations?.finalOutcome?.operationId;
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Authorized final-outcome persistence requires a transaction client.');
  }
  if (!classificationId ||
      operationId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.RECORD_FINAL_OUTCOME) {
    throw new TypeError('Authorized final-outcome persistence requires a final-outcome operation.');
  }

  const result = await outcomeService.recordOutcome(
    classificationId,
    buildPolicyAuthorizedOutcomeProjection(source),
    { client },
  );
  if (result?.updated !== true) {
    throw new Error('Authorized final-outcome projection was not persisted.');
  }

  return {
    operationId,
    persisted: true,
    reasonId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.FINAL_OUTCOME_PERSISTED,
  };
}

async function writePolicyAuthorizedExactItemMemory({
  client,
  command,
  executionState,
  evidenceService = classificationEvidenceService,
} = {}) {
  const source = asObject(command);
  const operation = asObject(source.operations?.learning);
  const classification = asObject(executionState?.classification);
  const destination = asObject(executionState?.destination);
  const authorization = asObject(source.authorization);
  const tmdbId = normalizeIdentifier(classification.tmdbId);
  const mediaType = normalizeString(classification.mediaType, 20).toLowerCase();

  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Authorized exact-item memory requires a transaction client.');
  }
  if (operation.operationId !==
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_EXACT_ITEM_MEMORY ||
      !tmdbId || !['movie', 'tv'].includes(mediaType) || !destination.id) {
    throw new TypeError('Authorized exact-item memory requires a locked exact-item reference.');
  }

  const evidence = await evidenceService.rememberExactMatch({
    tmdbId,
    mediaType,
    libraryId: destination.id,
    createdBy: normalizeString(authorization.actorId, 128) || null,
    client,
    conflictMode: 'do_nothing',
  });

  return {
    operationId: operation.operationId,
    persisted: Boolean(evidence),
    reasonId: evidence
      ? POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.EXACT_ITEM_MEMORY_PERSISTED
      : POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.EXACT_ITEM_MEMORY_ALREADY_PRESENT,
  };
}

export {
  buildPolicyAuthorizedOutcomeProjection,
  persistPolicyAuthorizedFinalOutcome,
  writePolicyAuthorizedExactItemMemory,
};
