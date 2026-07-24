/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { policyConstraintWriteAdmissionLimiterConfig } from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  ConflictError,
  ForbiddenError,
  ServiceUnavailableError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  admitPolicyConstraintWrite,
  buildPolicyConstraintWriteAdmissionAudit,
  POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS,
  validatePolicyConstraintWriteAdmissionRequest,
} from '../services/policyConstraintWriteAdmission.mjs';
import {
  loadPolicyOperatorWorkflowLibrary,
  normalizePolicyOperatorWorkflowLibraryId,
} from './policyOperatorWorkflowRouteContext.mjs';

function createPolicyConstraintWriteAdmissionLimiter(rateLimit) {
  return typeof rateLimit === 'function'
    ? rateLimit(policyConstraintWriteAdmissionLimiterConfig)
    : (_req, _res, next) => next();
}

function toAdmissionActor(user = {}) {
  return {
    id: user?.id,
    role: user?.role,
    authenticated: Boolean(user),
  };
}

function getAdmissionHttpError(result = {}) {
  if (result.statusId === POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.UNAUTHORIZED_ACTOR) {
    return new ForbiddenError('Admin access required');
  }

  if (result.statusId === POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.INVALID_REQUEST) {
    return new ValidationError('Constraint write admission request is invalid.', {
      code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_INVALID',
    });
  }

  if (result.statusId === POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.CONTRACT_UNAVAILABLE) {
    return new ServiceUnavailableError('Constraint admission is temporarily unavailable.', {
      code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_UNAVAILABLE',
    });
  }

  return new ConflictError('Constraint command no longer matches the active library.', {
    code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_NOT_ELIGIBLE',
  });
}

export function registerPolicyConstraintAdmissionRoutes(router, {
  db,
  logger,
  rateLimit,
  admitConstraintWrite = admitPolicyConstraintWrite,
} = {}) {
  const admissionLimiter = createPolicyConstraintWriteAdmissionLimiter(rateLimit);

  router.post(
    '/operator-workflow/libraries/:libraryId/constraints/admission',
    admissionLimiter,
    asyncHandler(async (req, res) => {
      const libraryId = normalizePolicyOperatorWorkflowLibraryId(req.params.libraryId);
      if (libraryId === null) {
        throw new ValidationError('libraryId must be a positive integer');
      }

      if (req.user?.role !== 'admin') {
        throw new ForbiddenError('Admin access required');
      }

      const requestValidation = validatePolicyConstraintWriteAdmissionRequest(req.body);
      if (!requestValidation.ok) {
        logger?.warn('Rejected malformed policy constraint write admission', {
          libraryId,
          code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_INVALID',
        });
        throw new ValidationError('Constraint write admission request is invalid.', {
          code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_INVALID',
        });
      }

      const library = await loadPolicyOperatorWorkflowLibrary({ db, libraryId });
      const result = admitConstraintWrite({
        payload: req.body,
        actor: toAdmissionActor(req.user),
        library,
      });

      const admissionAudit = buildPolicyConstraintWriteAdmissionAudit(result);
      if (!admissionAudit.ok) {
        logger?.error('Policy constraint write admission contract failed validation', {
          libraryId,
          riskIds: admissionAudit.issues.map(issue => issue.riskId),
        });
        throw new ServiceUnavailableError('Constraint admission is temporarily unavailable.', {
          code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_UNAVAILABLE',
        });
      }

      if (result.ok !== true) {
        logger?.warn('Rejected policy constraint write admission', {
          libraryId,
          statusId: result.statusId,
          riskId: result.issues?.[0]?.riskId ?? null,
        });
        throw getAdmissionHttpError(result);
      }

      logger?.info('Admitted policy constraint command without persistence', {
        libraryId,
        controlId: result.admittedCommand?.controlId ?? null,
        statusId: result.statusId,
      });

      return sendData(res, result);
    }),
  );
}

export {
  createPolicyConstraintWriteAdmissionLimiter,
  getAdmissionHttpError,
  toAdmissionActor,
};
