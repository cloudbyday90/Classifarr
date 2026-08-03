/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/appError.mjs';
import {
  buildPolicyRuntimeExactItemMemoryAuthorizationContext,
} from '../services/policyRuntimeExactItemMemoryExecutionAuthorization.mjs';
import {
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_COMMAND_REASON_IDS,
  PolicyRuntimeExactItemMemoryCommandError,
  PolicyRuntimeExactItemMemoryCommandService,
} from '../services/policyRuntimeExactItemMemoryCommandService.mjs';
import {
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS,
} from '../services/policyRuntimeExactItemMemoryExecutionState.mjs';

function getActor(req) {
  const actor = req.user?.username || req.user?.email || req.user?.id ||
    (req.apiKey?.id ? `api-key:${req.apiKey.id}` : 'operator');

  return String(actor).trim().slice(0, 100) || 'operator';
}

function buildAuthorizationContext(req, actorId) {
  return buildPolicyRuntimeExactItemMemoryAuthorizationContext({
    actorId,
    authenticated: Boolean(req.user || req.apiKey),
  });
}

function rethrowExactItemMemoryCommandError(error) {
  if (!(error instanceof PolicyRuntimeExactItemMemoryCommandError)) {
    throw error;
  }

  switch (error.reasonId) {
    case 'authorized_outcome_execution_classification_not_found':
      throw new NotFoundError('Classification not found');
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_COMMAND_REASON_IDS.EXECUTION_BLOCKED:
      if (error.execution?.reasonCodes?.includes(
        'authorized_persistence_authorization_revalidation_required',
      )) {
        throw new ForbiddenError('Exact-item memory command is not authorized');
      }
      throw new ConflictError('Classification changed before exact-item memory could be recorded');
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_COMMAND_REASON_IDS.ADMISSION_BLOCKED:
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.FINAL_OUTCOME_MISSING:
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.FINAL_OUTCOME_NOT_RUNTIME_RESOLUTION:
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.FINAL_OUTCOME_DESTINATION_MISMATCH:
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.INVALID_RUNTIME_ANSWER:
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.SOURCE_EVENT_IDENTITY_MISMATCH:
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.CLASSIFICATION_STATE_INVALID:
    case POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.TMDB_REFERENCE_MISSING:
      throw new ConflictError('Classification is not eligible for exact-item memory');
    default:
      throw error;
  }
}

function buildExactItemMemoryResponse(result = {}) {
  const execution = result.execution || {};
  const learning = execution.operations?.learning || {};

  return {
    status: execution.statusId,
    replayed: execution.replayed === true,
    exact_item_memory_recorded: learning.persisted === true,
    exact_item_memory_already_present:
      execution.replayed !== true && learning.persisted === false,
    reason_codes: execution.reasonCodes || [],
  };
}

export function registerExactItemMemoryRoutes(router, {
  db,
  logger,
  requireReadWrite,
  policyRuntimeExactItemMemoryCommandService =
    new PolicyRuntimeExactItemMemoryCommandService({ db }),
}) {
  router.post('/history/:id/exact-item-memory', requireReadWrite, asyncHandler(async (req, res) => {
    if (req.body && Object.keys(req.body).length > 0) {
      throw new ValidationError('Exact-item memory command does not accept request fields');
    }

    const classificationId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(classificationId) || classificationId < 1) {
      throw new ValidationError('Invalid classification id');
    }

    const actorId = getActor(req);
    let result;
    try {
      result = await policyRuntimeExactItemMemoryCommandService.execute({
        classificationId,
        actorId,
        authorizationContext: buildAuthorizationContext(req, actorId),
      });
    } catch (error) {
      rethrowExactItemMemoryCommandError(error);
    }

    const response = buildExactItemMemoryResponse(result);
    logger.info('Runtime exact-item memory command completed', {
      classification_id: classificationId,
      actor_id: actorId,
      status: response.status,
      replayed: response.replayed,
      exact_item_memory_recorded: response.exact_item_memory_recorded,
      reason_codes: response.reason_codes,
    });
    res.json(response);
  }));
}

export {
  buildExactItemMemoryResponse,
  rethrowExactItemMemoryCommandError,
};
