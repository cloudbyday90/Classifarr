/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS = Object.freeze({
  LEARNING_EVIDENCE: 'learning_evidence',
  NATIVE_READINESS: 'native_readiness',
  INVENTORY_CHANGE: 'inventory_change',
});

const POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM_IDS = Object.freeze({
  LEARNING_EVIDENCE: 'policy_authorized_profile_refresh',
  NATIVE_READINESS: 'policy_native_readiness_profile_refresh',
});

const POLICY_PROFILE_REFRESH_OUTBOX_REFRESH_REASON_IDS = Object.freeze({
  LEARNING_EVIDENCE: 'profile_refresh_required',
  NATIVE_READINESS: 'stale_library_profile',
});

const POLICY_PROFILE_REFRESH_OUTBOX_ACTIVE_STATE_IDS = Object.freeze([
  'pending',
  'processing',
]);

function isPolicyProfileRefreshOutboxRequestType(value) {
  return Object.values(POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS).includes(value);
}

export {
  isPolicyProfileRefreshOutboxRequestType,
  POLICY_PROFILE_REFRESH_OUTBOX_ACTIVE_STATE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_REFRESH_REASON_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM_IDS,
};
