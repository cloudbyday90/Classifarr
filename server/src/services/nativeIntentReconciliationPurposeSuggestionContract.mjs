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
  buildPolicyLibraryProfileInitialIntentContract,
} from './policyLibraryProfileInitialIntent.mjs';

const NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_VERSION =
  'native_intent_reconciliation_purpose_suggestion.v1';
const MAX_PURPOSE_SUGGESTION_VALUES = 5;

const NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS = Object.freeze({
  AVAILABLE: 'available',
  POLICY_NOT_FOUND: 'policy_not_found',
  POLICY_NOT_ACTIONABLE: 'policy_not_actionable',
  NATIVE_AUTHORITY_ACTIVE: 'native_authority_active',
  PROFILE_MISSING: 'profile_missing',
  PROFILE_STALE: 'profile_stale',
  PROFILE_INSUFFICIENT: 'profile_insufficient',
  SUGGESTION_UNAVAILABLE: 'suggestion_unavailable',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function asNonEmptyString(value, maximumLength = 160) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const normalized = String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximumLength);

  return normalized || null;
}

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function isPurposeMaintenanceRecord(record = {}) {
  return record.outcome_state === 'requires_maintenance' &&
    record.candidate_status_id === 'no_convertible_intent' &&
    record.reason_id === 'no_convertible_intent';
}

function buildPolicy(record = {}) {
  const id = asPositiveInteger(record.policy_id);
  if (!id) return null;

  return {
    id,
    name: asNonEmptyString(record.policy_name, 180) || 'Unnamed policy',
  };
}

function buildLibrary(record = {}) {
  const id = asPositiveInteger(record.library_id);
  if (!id) return null;

  return {
    id,
    name: asNonEmptyString(record.library_name, 160) || 'Unnamed library',
    mediaType: asNonEmptyString(record.library_media_type, 80),
  };
}

function buildUnavailableSuggestion({
  statusId,
  policy = null,
  library = null,
  profile = null,
} = {}) {
  return {
    version: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_VERSION,
    statusId,
    available: false,
    policy,
    library,
    profile,
    suggestion: null,
    rawProfileExposed: false,
    persisted: false,
    routingAffected: false,
    learningAffected: false,
    aiInvoked: false,
  };
}

function mapProfileStatus(profileStatusId) {
  switch (profileStatusId) {
    case 'profile_missing':
      return NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.PROFILE_MISSING;
    case 'profile_stale':
      return NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.PROFILE_STALE;
    case 'profile_insufficient':
      return NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.PROFILE_INSUFFICIENT;
    default:
      return NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.SUGGESTION_UNAVAILABLE;
  }
}

function buildProfilePurposeSuggestion(initialIntent = {}) {
  const purpose = Array.isArray(initialIntent?.contract?.purpose)
    ? initialIntent.contract.purpose
    : [];
  const genreRule = purpose.find(rule => (
    rule?.signal_type === 'genres' &&
    rule?.operator === 'require_any' &&
    rule?.semantics === 'identity' &&
    rule?.constraint_mode === 'advisory'
  ));
  const values = Array.isArray(genreRule?.values?.require_any)
    ? genreRule.values.require_any
      .map(value => asNonEmptyString(value, 120))
      .filter(Boolean)
      .slice(0, MAX_PURPOSE_SUGGESTION_VALUES)
    : [];

  if (values.length === 0) return null;

  return {
    sourceId: 'current_library_profile',
    rules: [{
      signalType: 'genres',
      operator: 'require_any',
      values,
      semantics: 'identity',
      constraintMode: 'advisory',
    }],
  };
}

function buildNativeIntentReconciliationPurposeSuggestion({ record = null, now = new Date() } = {}) {
  if (!record) {
    return buildUnavailableSuggestion({
      statusId: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.POLICY_NOT_FOUND,
    });
  }

  const policy = buildPolicy(record);
  const library = buildLibrary(record);
  if (!policy || !library) {
    return buildUnavailableSuggestion({
      statusId: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.POLICY_NOT_FOUND,
    });
  }

  if (record.native_authority_active === true) {
    return buildUnavailableSuggestion({
      statusId: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.NATIVE_AUTHORITY_ACTIVE,
      policy,
      library,
    });
  }

  if (!isPurposeMaintenanceRecord(record)) {
    return buildUnavailableSuggestion({
      statusId: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.POLICY_NOT_ACTIONABLE,
      policy,
      library,
    });
  }

  const initialIntent = buildPolicyLibraryProfileInitialIntentContract({
    policy: {
      id: policy.id,
      library_id: library.id,
      library_name: library.name,
      library_media_type: library.mediaType,
      libraryProfile: asObject(record),
    },
    now,
  });
  const profile = {
    itemCount: initialIntent.profile?.itemCount ?? null,
    generatedAt: toIsoTimestamp(initialIntent.profile?.generatedAt),
    genreSignalCount: initialIntent.profile?.genreSignalCount ?? 0,
  };

  if (initialIntent.ready !== true) {
    return buildUnavailableSuggestion({
      statusId: mapProfileStatus(initialIntent.statusId),
      policy,
      library,
      profile,
    });
  }

  const suggestion = buildProfilePurposeSuggestion(initialIntent);
  if (!suggestion) {
    return buildUnavailableSuggestion({
      statusId: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.SUGGESTION_UNAVAILABLE,
      policy,
      library,
      profile,
    });
  }

  return {
    version: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_VERSION,
    statusId: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.AVAILABLE,
    available: true,
    policy,
    library,
    profile,
    suggestion,
    rawProfileExposed: false,
    persisted: false,
    routingAffected: false,
    learningAffected: false,
    aiInvoked: false,
  };
}

export {
  NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS,
  NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_VERSION,
  buildNativeIntentReconciliationPurposeSuggestion,
};
