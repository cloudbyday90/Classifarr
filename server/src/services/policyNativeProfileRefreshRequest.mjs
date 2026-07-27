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
  POLICY_PROFILE_REFRESH_OUTBOX_REFRESH_REASON_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM_IDS,
} from './policyProfileRefreshOutboxVocabulary.mjs';

const POLICY_NATIVE_PROFILE_REFRESH_REQUEST_VERSION =
  'policy.native_profile_refresh_request.v1';

const POLICY_NATIVE_PROFILE_REFRESH_SOURCE_ID = 'native_policy_profile_readiness';

const POLICY_NATIVE_PROFILE_REFRESH_PROFILE_STATE_IDS = Object.freeze({
  MISSING: 'missing_profile',
  STALE: 'stale_profile',
});

const POLICY_NATIVE_PROFILE_REFRESH_REQUEST_STATUS_IDS = Object.freeze({
  READY: 'ready',
  NOT_REQUIRED: 'not_required',
  INVALID: 'invalid',
});

function normalizeLibraryId(value) {
  const libraryId = Number(value);
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null;
}

function normalizeProfileGeneratedAt(value) {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function isKnownProfileState(value) {
  return Object.values(POLICY_NATIVE_PROFILE_REFRESH_PROFILE_STATE_IDS).includes(value);
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function buildSourceEventId({
  libraryId,
  profileState,
  profileGeneratedAt,
  observedItemCount,
  observedItemHighWaterMark,
}) {
  if (profileState === POLICY_NATIVE_PROFILE_REFRESH_PROFILE_STATE_IDS.MISSING) {
    return `library-profile:${libraryId}:missing_profile:items:${observedItemCount}:high-water:${observedItemHighWaterMark}`;
  }

  return `library-profile:${libraryId}:${profileState}:${profileGeneratedAt}`;
}

function buildResult({ statusId, reasonCodes = [], record = null } = {}) {
  return {
    version: POLICY_NATIVE_PROFILE_REFRESH_REQUEST_VERSION,
    statusId,
    ready: statusId === POLICY_NATIVE_PROFILE_REFRESH_REQUEST_STATUS_IDS.READY,
    reasonCodes: [...new Set(reasonCodes.filter(Boolean))],
    record,
  };
}

function buildPolicyNativeProfileRefreshRequest({
  libraryId,
  profileState,
  profileGeneratedAt = null,
  observedItemCount = null,
  observedItemHighWaterMark = null,
} = {}) {
  const normalizedLibraryId = normalizeLibraryId(libraryId);
  const normalizedGeneratedAt = normalizeProfileGeneratedAt(profileGeneratedAt);
  const normalizedItemCount = normalizePositiveInteger(observedItemCount);
  const normalizedItemHighWaterMark = normalizePositiveInteger(observedItemHighWaterMark);

  if (!normalizedLibraryId || !isKnownProfileState(profileState)) {
    return buildResult({
      statusId: POLICY_NATIVE_PROFILE_REFRESH_REQUEST_STATUS_IDS.INVALID,
      reasonCodes: ['invalid_native_profile_refresh_candidate'],
    });
  }

  if (
    profileState === POLICY_NATIVE_PROFILE_REFRESH_PROFILE_STATE_IDS.STALE &&
    !normalizedGeneratedAt
  ) {
    return buildResult({
      statusId: POLICY_NATIVE_PROFILE_REFRESH_REQUEST_STATUS_IDS.INVALID,
      reasonCodes: ['stale_native_profile_without_timestamp'],
    });
  }
  if (
    profileState === POLICY_NATIVE_PROFILE_REFRESH_PROFILE_STATE_IDS.MISSING &&
    (!normalizedItemCount || !normalizedItemHighWaterMark)
  ) {
    return buildResult({
      statusId: POLICY_NATIVE_PROFILE_REFRESH_REQUEST_STATUS_IDS.INVALID,
      reasonCodes: ['missing_native_profile_without_observed_content_revision'],
    });
  }

  return buildResult({
    statusId: POLICY_NATIVE_PROFILE_REFRESH_REQUEST_STATUS_IDS.READY,
    record: {
      sourceId: POLICY_NATIVE_PROFILE_REFRESH_SOURCE_ID,
      sourceEventId: buildSourceEventId({
        libraryId: normalizedLibraryId,
        profileState,
        profileGeneratedAt: normalizedGeneratedAt,
        observedItemCount: normalizedItemCount,
        observedItemHighWaterMark: normalizedItemHighWaterMark,
      }),
      classificationId: null,
      libraryId: normalizedLibraryId,
      learningOperationId: null,
      learningTierId: null,
      candidateKey: null,
      refreshReasonId: POLICY_PROFILE_REFRESH_OUTBOX_REFRESH_REASON_IDS.NATIVE_READINESS,
      requestType: POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS.NATIVE_READINESS,
      sourceSystem: POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM_IDS.NATIVE_READINESS,
    },
  });
}

export {
  buildPolicyNativeProfileRefreshRequest,
  buildSourceEventId,
  POLICY_NATIVE_PROFILE_REFRESH_PROFILE_STATE_IDS,
  POLICY_NATIVE_PROFILE_REFRESH_REQUEST_STATUS_IDS,
  POLICY_NATIVE_PROFILE_REFRESH_REQUEST_VERSION,
  POLICY_NATIVE_PROFILE_REFRESH_SOURCE_ID,
};
