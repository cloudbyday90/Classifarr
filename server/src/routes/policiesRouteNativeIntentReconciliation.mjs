/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  nativeIntentReconciliationLifecycleService,
} from '../services/nativeIntentReconciliationLifecycleService.mjs';
import {
  nativeIntentReconciliationControlService,
} from '../services/nativeIntentReconciliationControlService.mjs';
import {
  nativeIntentReconciliationStatusService,
} from '../services/nativeIntentReconciliationStatusService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function toReasonCode(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getReentryError(result) {
  switch (result?.reasonId) {
    case 'reentry_policy_invalid':
    case 'reentry_actor_identity_required':
    case 'reentry_reason_invalid':
      return new ValidationError('A valid policy, administrator identity, and reason code are required.', {
        code: 'POLICY_RECONCILIATION_REENTRY_REQUEST_INVALID',
      });
    case 'reentry_policy_not_found':
      return new NotFoundError('Policy reconciliation hold not found');
    default:
      return new ConflictError('Policy reconciliation cannot re-enter in its current state.', {
        code: 'POLICY_RECONCILIATION_REENTRY_BLOCKED',
      });
  }
}

function getControlActionError(result) {
  if (result?.reasonId === 'control_action_invalid') {
    return new ValidationError('A verified administrator identity and valid reason code are required.', {
      code: 'POLICY_RECONCILIATION_CONTROL_REQUEST_INVALID',
    });
  }

  return new ConflictError('Native intent reconciliation control cannot change in its current state.', {
    code: 'POLICY_RECONCILIATION_CONTROL_CHANGE_BLOCKED',
  });
}

function requireAdministratorAction(req) {
  if (req.user?.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }

  const actorId = toPositiveInteger(req.user.id);
  if (!actorId) {
    throw new ValidationError('A verified administrator identity is required.', {
      code: 'POLICY_RECONCILIATION_CONTROL_ACTOR_REQUIRED',
    });
  }

  return {
    actorId,
    reasonCode: toReasonCode(req.body?.reason_code),
  };
}

export function registerPolicyNativeIntentReconciliationRoutes(router, { db, logger }) {
  router.get('/native-intent-reconciliation/status', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    return sendData(res, await nativeIntentReconciliationStatusService.getStatus({ dbClient: db }));
  }));

  router.get('/native-intent-reconciliation/control', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    return sendData(res, await nativeIntentReconciliationControlService.getStatus({ dbClient: db }));
  }));

  router.post('/native-intent-reconciliation/control/emergency-stop', asyncHandler(async (req, res) => {
    const action = requireAdministratorAction(req);
    const result = await nativeIntentReconciliationControlService.disableAutomation({
      dbClient: db,
      action,
    });
    if (!result.changed) throw getControlActionError(result);

    logger.warn?.('Native intent reconciliation emergency stop enabled', {
      actorId: action.actorId,
      reasonId: result.reasonId,
    });
    return sendData(res, result);
  }));

  router.post('/native-intent-reconciliation/control/resume', asyncHandler(async (req, res) => {
    const action = requireAdministratorAction(req);
    const result = await nativeIntentReconciliationControlService.resumeAutomation({
      dbClient: db,
      action,
    });
    if (!result.changed) throw getControlActionError(result);

    logger.info('Native intent reconciliation emergency stop released', {
      actorId: action.actorId,
      reasonId: result.reasonId,
    });
    return sendData(res, result);
  }));

  router.post('/native-intent-reconciliation/control/reset', asyncHandler(async (req, res) => {
    const action = requireAdministratorAction(req);
    const result = await nativeIntentReconciliationControlService.resetCircuit({
      dbClient: db,
      action,
    });
    if (!result.changed) throw getControlActionError(result);

    logger.info('Native intent reconciliation circuit reset approved', {
      actorId: action.actorId,
      reasonId: result.reasonId,
    });
    return sendData(res, result);
  }));

  router.post('/:id/native-intent-reconciliation/reentry', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const actorId = toPositiveInteger(req.user.id);
    if (!actorId) {
      throw new ValidationError('A verified administrator identity is required for reconciliation re-entry.', {
        code: 'POLICY_RECONCILIATION_REENTRY_ACTOR_REQUIRED',
      });
    }

    const result = await nativeIntentReconciliationLifecycleService.approvePolicyReentry({
      dbClient: db,
      policyId: req.params.id,
      action: {
        actorSourceId: 'manual_operator',
        actorId,
        reasonCode: toReasonCode(req.body?.reason_code),
      },
    });
    if (!result.approved) {
      throw getReentryError(result);
    }

    logger.info('Policy reconciliation re-entry approved', {
      policyId: result.policyId,
      actorId,
      reasonId: result.reasonId,
    });
    return sendData(res, result);
  }));
}
