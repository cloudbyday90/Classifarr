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

function getServerActorId(user = {}) {
  const userId = String(user?.id ?? '').trim();
  return /^[A-Za-z0-9:_-]{1,150}$/.test(userId) ? `user:${userId}` : 'admin';
}

function validateApplyBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('A JSON object with classificationIds is required.');
  }

  const fields = Object.keys(body);
  if (fields.length !== 1 || fields[0] !== 'classificationIds') {
    throw new ValidationError('Only classificationIds may be supplied for pending-question cleanup.');
  }
}

export function registerPendingQuestionCleanupApplyRoute(router, {
  policyRuntimePendingQuestionCleanupApplyService,
  requireReadWrite,
} = {}) {
  if (typeof policyRuntimePendingQuestionCleanupApplyService?.run !== 'function') {
    throw new TypeError('Pending-question cleanup apply route requires an apply service.');
  }
  if (typeof requireReadWrite !== 'function') {
    throw new TypeError('Pending-question cleanup apply route requires read-write authorization.');
  }

  router.post('/pending-cleanup/apply', requireAdmin, requireReadWrite, asyncHandler(async (req, res) => {
    validateApplyBody(req.body);
    const result = await policyRuntimePendingQuestionCleanupApplyService.run({
      classificationIds: req.body.classificationIds,
      actorId: getServerActorId(req.user),
    });

    res.set('Cache-Control', 'no-store');
    res.json(result);
  }));
}

export {
  getServerActorId,
  validateApplyBody,
};
