/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_MAX_AGE_SECONDS,
  buildRecentChange,
  buildRecentReceiptDiscoveryCompleteResult,
  buildRecentReceiptDiscoveryUnavailableResult,
  validatePolicyNativeIntentChangeRecentReceiptDiscovery,
} from './policyNativeIntentChangeRecentReceiptDiscoveryContract.mjs';
import {
  loadPolicyNativeIntentChangeRecentReceiptDiscoveryContext,
} from './policyNativeIntentChangeRecentReceiptDiscoveryPersistence.mjs';

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function createPolicyNativeIntentChangeRecentReceiptDiscoveryService({
  loadContext = loadPolicyNativeIntentChangeRecentReceiptDiscoveryContext,
  maxAgeSeconds = POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_MAX_AGE_SECONDS,
} = {}) {
  async function getRecentReceipt({ dbClient = defaultDb, policyId, actorId } = {}) {
    const normalizedPolicyId = normalizePositiveInteger(policyId);
    const normalizedActorId = normalizePositiveInteger(actorId);
    const normalizedMaxAgeSeconds = normalizePositiveInteger(maxAgeSeconds);

    if (
      !normalizedPolicyId ||
      !normalizedActorId ||
      !normalizedMaxAgeSeconds ||
      typeof dbClient?.withTransaction !== 'function'
    ) {
      return buildRecentReceiptDiscoveryUnavailableResult(normalizedPolicyId);
    }

    try {
      const result = await dbClient.withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const receipt = await loadContext({
          client,
          actorId: normalizedActorId,
          policyId: normalizedPolicyId,
          maxAgeSeconds: normalizedMaxAgeSeconds,
        });
        const recentChange = receipt ? buildRecentChange(receipt) : null;
        if (receipt && recentChange === null) {
          throw new Error('Recent native intent receipt discovery returned an invalid receipt.');
        }
        return buildRecentReceiptDiscoveryCompleteResult({
          policyId: normalizedPolicyId,
          recentChange,
        });
      });

      return validatePolicyNativeIntentChangeRecentReceiptDiscovery(result).ok
        ? result
        : buildRecentReceiptDiscoveryUnavailableResult(normalizedPolicyId);
    } catch {
      return buildRecentReceiptDiscoveryUnavailableResult(normalizedPolicyId);
    }
  }

  return { getRecentReceipt };
}

const policyNativeIntentChangeRecentReceiptDiscoveryService =
  createPolicyNativeIntentChangeRecentReceiptDiscoveryService();

export {
  createPolicyNativeIntentChangeRecentReceiptDiscoveryService,
  policyNativeIntentChangeRecentReceiptDiscoveryService,
};
