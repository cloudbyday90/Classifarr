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
  buildConfirmedOutcomePurposeSuggestionReadUnavailableResult,
  buildPolicyNativeIntentConfirmedOutcomePurposeSuggestion,
} from './policyNativeIntentConfirmedOutcomePurposeSuggestionContract.mjs';
import {
  loadPolicyNativeIntentConfirmedOutcomePurposeSuggestionContext,
} from './policyNativeIntentConfirmedOutcomePurposeSuggestionPersistence.mjs';

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function createPolicyNativeIntentConfirmedOutcomePurposeSuggestionService({
  loadContext = loadPolicyNativeIntentConfirmedOutcomePurposeSuggestionContext,
  buildSuggestion = buildPolicyNativeIntentConfirmedOutcomePurposeSuggestion,
} = {}) {
  async function getSuggestion({ dbClient = defaultDb, policyId } = {}) {
    const normalizedPolicyId = normalizePositiveInteger(policyId);
    if (!normalizedPolicyId || typeof dbClient?.query !== 'function') {
      return buildConfirmedOutcomePurposeSuggestionReadUnavailableResult(normalizedPolicyId);
    }

    try {
      const context = await loadContext({ db: dbClient, policyId: normalizedPolicyId });
      return buildSuggestion({ context });
    } catch {
      return buildConfirmedOutcomePurposeSuggestionReadUnavailableResult(normalizedPolicyId);
    }
  }

  return { getSuggestion };
}

const policyNativeIntentConfirmedOutcomePurposeSuggestionService =
  createPolicyNativeIntentConfirmedOutcomePurposeSuggestionService();

export {
  createPolicyNativeIntentConfirmedOutcomePurposeSuggestionService,
  policyNativeIntentConfirmedOutcomePurposeSuggestionService,
};
