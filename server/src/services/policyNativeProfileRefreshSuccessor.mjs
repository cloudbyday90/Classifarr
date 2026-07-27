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
  POLICY_NATIVE_PROFILE_REFRESH_SOURCE_ID,
} from './policyNativeProfileRefreshRequest.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_REFRESH_REASON_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM_IDS,
} from './policyProfileRefreshOutboxVocabulary.mjs';

const POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_VERSION =
  'policy.native_profile_refresh_successor.v1';
const POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_INITIAL_DELAY_MS = 15 * 60 * 1000;
const POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_MAX_DELAY_MS = 24 * 60 * 60 * 1000;
const POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_JITTER_WINDOW_MS = 60 * 1000;
const MAX_SOURCE_EVENT_ID_LENGTH = 160;

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeDate(value) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function buildSuccessorSourceEventId({ sourceEventId, failedOutboxId } = {}) {
  const baseSourceEventId = typeof sourceEventId === 'string' ? sourceEventId.trim() : '';
  const failedId = normalizePositiveInteger(failedOutboxId);
  if (!baseSourceEventId || !failedId || baseSourceEventId.includes(':retry:')) {
    return null;
  }

  const successorSourceEventId = `${baseSourceEventId}:retry:${failedId}`;
  return successorSourceEventId.length <= MAX_SOURCE_EVENT_ID_LENGTH
    ? successorSourceEventId
    : null;
}

function calculateNativeProfileRefreshSuccessorDelayMs({
  failureCount,
  libraryId,
  initialDelayMs = POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_INITIAL_DELAY_MS,
  maximumDelayMs = POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_MAX_DELAY_MS,
  jitterWindowMs = POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_JITTER_WINDOW_MS,
} = {}) {
  const normalizedFailureCount = normalizePositiveInteger(failureCount) || 1;
  const normalizedLibraryId = normalizePositiveInteger(libraryId) || 1;
  const normalizedInitialDelay = normalizePositiveInteger(initialDelayMs) ||
    POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_INITIAL_DELAY_MS;
  const normalizedMaximumDelay = Math.max(
    normalizedInitialDelay,
    normalizePositiveInteger(maximumDelayMs) || POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_MAX_DELAY_MS,
  );
  const normalizedJitterWindow = Math.max(0, Number(jitterWindowMs) || 0);
  const exponent = Math.min(normalizedFailureCount - 1, 20);
  const exponentialDelay = Math.min(
    normalizedInitialDelay * (2 ** exponent),
    normalizedMaximumDelay,
  );
  const jitterSlots = Math.floor(normalizedJitterWindow / 1000);
  const deterministicJitter = jitterSlots > 0
    ? (normalizedLibraryId % jitterSlots) * 1000
    : 0;

  return Math.min(exponentialDelay + deterministicJitter, normalizedMaximumDelay);
}

function buildPolicyNativeProfileRefreshSuccessor({
  record = {},
  failedOutboxId,
  failureCount,
  now = new Date(),
} = {}) {
  const libraryId = normalizePositiveInteger(record.libraryId);
  const sourceEventId = buildSuccessorSourceEventId({
    sourceEventId: record.sourceEventId,
    failedOutboxId,
  });
  const evaluatedAt = normalizeDate(now);

  if (
    !libraryId ||
    !sourceEventId ||
    !evaluatedAt ||
    record.sourceId !== POLICY_NATIVE_PROFILE_REFRESH_SOURCE_ID ||
    record.requestType !== POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS.NATIVE_READINESS ||
    record.refreshReasonId !== POLICY_PROFILE_REFRESH_OUTBOX_REFRESH_REASON_IDS.NATIVE_READINESS ||
    record.sourceSystem !== POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM_IDS.NATIVE_READINESS
  ) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_VERSION,
      statusId: 'invalid',
      ready: false,
      reasonCodes: ['invalid_native_profile_refresh_successor'],
      record: null,
    };
  }

  const delayMs = calculateNativeProfileRefreshSuccessorDelayMs({
    failureCount,
    libraryId,
  });

  return {
    version: POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_VERSION,
    statusId: 'ready',
    ready: true,
    reasonCodes: ['terminal_native_profile_refresh_recovery'],
    record: {
      ...record,
      sourceEventId,
      availableAt: new Date(evaluatedAt.getTime() + delayMs).toISOString(),
    },
  };
}

export {
  buildPolicyNativeProfileRefreshSuccessor,
  buildSuccessorSourceEventId,
  calculateNativeProfileRefreshSuccessorDelayMs,
  POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_INITIAL_DELAY_MS,
  POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_JITTER_WINDOW_MS,
  POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_MAX_DELAY_MS,
  POLICY_NATIVE_PROFILE_REFRESH_SUCCESSOR_VERSION,
};
