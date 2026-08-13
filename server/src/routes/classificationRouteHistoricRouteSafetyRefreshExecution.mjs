/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { requireAdmin } from '../middleware/auth.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  requireHistoricRouteSafetyRefreshActorId,
} from './classificationRouteHistoricRouteSafetyRefreshActor.mjs';

function validateExecutionBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('A JSON object with classificationIds is required.');
  }

  const fields = Object.keys(body);
  if (fields.length !== 1 || fields[0] !== 'classificationIds') {
    throw new ValidationError('Only classificationIds may be supplied for historic route-safety refresh.');
  }
}

export function registerHistoricRouteSafetyRefreshExecutionRoute(router, {
  policyRuntimeHistoricRouteSafetyRefreshExecutionService,
  requireReadWrite,
} = {}) {
  if (typeof policyRuntimeHistoricRouteSafetyRefreshExecutionService?.run !== 'function') {
    throw new TypeError('Historic route-safety refresh execution route requires an execution service.');
  }
  if (typeof requireReadWrite !== 'function') {
    throw new TypeError('Historic route-safety refresh execution route requires read-write authorization.');
  }

  router.post('/pending/route-safety-refresh/retry', requireAdmin, requireReadWrite,
    asyncHandler(async (req, res) => {
      validateExecutionBody(req.body);
      const result = await policyRuntimeHistoricRouteSafetyRefreshExecutionService.run({
        classificationIds: req.body.classificationIds,
        actorId: requireHistoricRouteSafetyRefreshActorId(req.user),
      });

      res.set('Cache-Control', 'no-store');
      res.json(result);
    }));
}

export {
  validateExecutionBody,
};
