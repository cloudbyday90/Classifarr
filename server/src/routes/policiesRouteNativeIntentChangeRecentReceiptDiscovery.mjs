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
  ForbiddenError,
  ServiceUnavailableError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS,
  validatePolicyNativeIntentChangeRecentReceiptDiscovery,
} from '../services/policyNativeIntentChangeRecentReceiptDiscoveryContract.mjs';
import {
  policyNativeIntentChangeRecentReceiptDiscoveryService,
} from '../services/policyNativeIntentChangeRecentReceiptDiscoveryService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function requireEmptyRecentReceiptDiscoveryQuery(query) {
  if (Object.keys(query || {}).length > 0) {
    throw new ValidationError('Recent native intent receipt discovery does not accept query parameters.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_QUERY_INVALID',
    });
  }
}

export function registerPolicyNativeIntentChangeRecentReceiptDiscoveryRoutes(router, {
  db,
  recentReceiptDiscoveryService = policyNativeIntentChangeRecentReceiptDiscoveryService,
} = {}) {
  router.get('/:id/native-intent/change-receipts/recent', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const policyId = toPositiveInteger(req.params.id);
    const actorId = toPositiveInteger(req.user.id);
    if (!policyId) {
      throw new ValidationError('A valid policy identifier is required.', {
        code: 'POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_POLICY_ID_INVALID',
      });
    }
    if (!actorId) {
      throw new ForbiddenError('A stable authenticated administrator identity is required.', {
        code: 'POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_ACTOR_REQUIRED',
      });
    }

    requireEmptyRecentReceiptDiscoveryQuery(req.query);

    const result = await recentReceiptDiscoveryService.getRecentReceipt({
      dbClient: db,
      policyId,
      actorId,
    });

    if (
      !validatePolicyNativeIntentChangeRecentReceiptDiscovery(result).ok ||
      result.statusId ===
      POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.UNAVAILABLE) {
      throw new ServiceUnavailableError('Recent native change status is temporarily unavailable.', {
        code: 'POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_UNAVAILABLE',
      });
    }

    res.set('Cache-Control', 'no-store');
    return sendData(res, result);
  }));
}

export { requireEmptyRecentReceiptDiscoveryQuery };
