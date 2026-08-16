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
  normalizePolicyNativeIntentChangePurposeCommand,
} from './policyNativeIntentChangePurposePreflightContract.mjs';
import {
  buildPurposeChangeAuthorityUnavailableResult,
  buildPurposeChangeAvailableResult,
  buildPurposeChangePolicyNotFoundResult,
  buildPurposeChangeReadUnavailableResult,
  validatePolicyNativeIntentPurposeChangeRead,
} from './policyNativeIntentPurposeChangeReadContract.mjs';
import {
  loadPolicyNativeIntentPurposeChangeReadContext,
} from './policyNativeIntentPurposeChangeReadPersistence.mjs';

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function buildStoredPurposeChangeCommand(purposeRules = []) {
  return normalizePolicyNativeIntentChangePurposeCommand({
    command_id: 'update_purpose',
    values: purposeRules,
  });
}

function createPolicyNativeIntentPurposeChangeReadService({
  loadContext = loadPolicyNativeIntentPurposeChangeReadContext,
} = {}) {
  async function getPurposeChange({ dbClient = defaultDb, policyId } = {}) {
    const normalizedPolicyId = normalizePositiveInteger(policyId);
    if (!normalizedPolicyId || typeof dbClient?.query !== 'function') {
      return buildPurposeChangeReadUnavailableResult(normalizedPolicyId);
    }

    try {
      const context = await loadContext({ db: dbClient, policyId: normalizedPolicyId });
      if (!context) return buildPurposeChangePolicyNotFoundResult(normalizedPolicyId);

      const revision = normalizePositiveInteger(context.activeIntent?.intent_version);
      if (context.authority?.authoritative !== true || !revision) {
        return buildPurposeChangeAuthorityUnavailableResult({
          policyId: normalizedPolicyId,
          revision,
        });
      }

      const result = buildPurposeChangeAvailableResult({
        policyId: normalizedPolicyId,
        revision,
        changeCommand: buildStoredPurposeChangeCommand(context.purposeRules),
      });

      return validatePolicyNativeIntentPurposeChangeRead(result).ok
        ? result
        : buildPurposeChangeReadUnavailableResult(normalizedPolicyId);
    } catch {
      return buildPurposeChangeReadUnavailableResult(normalizedPolicyId);
    }
  }

  return { getPurposeChange };
}

const policyNativeIntentPurposeChangeReadService =
  createPolicyNativeIntentPurposeChangeReadService();

export {
  buildStoredPurposeChangeCommand,
  createPolicyNativeIntentPurposeChangeReadService,
  policyNativeIntentPurposeChangeReadService,
};
