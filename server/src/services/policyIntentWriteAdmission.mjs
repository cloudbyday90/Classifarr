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
  buildPolicyIntentWritePreflight,
} from './policyIntentRequestValidator.mjs';
import {
  buildNativeIntentCreateRequest,
  validateNativePolicyCreateIdentity,
} from './policyNativeIntentCreateContract.mjs';
import {
  readNativePolicyCreateIdempotencyKey,
} from './policyNativeIntentCreateIdempotency.mjs';

const NATIVE_INTENT_ESTABLISHMENT_FIELD = 'native_intent_establishment';

export const POLICY_INTENT_WRITE_OPERATION_IDS = Object.freeze({
  LEGACY_COMPATIBILITY_CREATE: 'legacy_compatibility_create',
  LEGACY_COMPATIBILITY_UPDATE: 'legacy_compatibility_update',
  NATIVE_INITIAL_INTENT_CREATE: 'native_initial_intent_create',
});

export class PolicyIntentWriteAdmissionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PolicyIntentWriteAdmissionError';
    this.code = code;
  }
}

function nativeIntentRequested(payload) {
  return payload?.[NATIVE_INTENT_ESTABLISHMENT_FIELD] !== undefined;
}

function buildLegacyAdmission({ operationId, payload }) {
  const preflight = buildPolicyIntentWritePreflight(payload);

  return {
    operationId,
    authorityMode: 'legacy_compatibility',
    intentWritePreflight: preflight,
    nativeCreate: null,
  };
}

export function buildPolicyCreateWriteAdmission({
  payload = {},
  actorId,
  actorRole,
  headers,
} = {}) {
  if (!nativeIntentRequested(payload)) {
    return buildLegacyAdmission({
      operationId: POLICY_INTENT_WRITE_OPERATION_IDS.LEGACY_COMPATIBILITY_CREATE,
      payload,
    });
  }

  if (actorRole !== 'admin') {
    throw new PolicyIntentWriteAdmissionError(
      'Admin access required for native policy creation.',
      'POLICY_NATIVE_INTENT_CREATE_ADMIN_REQUIRED'
    );
  }

  const identity = validateNativePolicyCreateIdentity(payload);
  const idempotencyKey = readNativePolicyCreateIdempotencyKey(headers);
  const establishmentRequest = buildNativeIntentCreateRequest({
    payload,
    actorId,
    idempotencyKey,
    legacyPresetCount: 0,
  });

  return {
    operationId: POLICY_INTENT_WRITE_OPERATION_IDS.NATIVE_INITIAL_INTENT_CREATE,
    authorityMode: 'native_intent',
    intentWritePreflight: null,
    nativeCreate: {
      identity,
      establishmentRequest,
    },
  };
}

export function buildPolicyUpdateWriteAdmission({ payload = {} } = {}) {
  if (nativeIntentRequested(payload)) {
    throw new PolicyIntentWriteAdmissionError(
      'Native intent establishment is available only when creating a policy.',
      'POLICY_NATIVE_INTENT_UPDATE_UNSUPPORTED'
    );
  }

  return buildLegacyAdmission({
    operationId: POLICY_INTENT_WRITE_OPERATION_IDS.LEGACY_COMPATIBILITY_UPDATE,
    payload,
  });
}

export function buildPolicyIntentWriteResult({ admission, replayed = false } = {}) {
  const preflight = admission?.intentWritePreflight;
  const isNative = admission?.authorityMode === 'native_intent';

  return {
    version: 1,
    operation_id: admission?.operationId ?? 'unknown',
    authority_mode: admission?.authorityMode ?? 'unknown',
    persistence_status: replayed ? 'replayed' : 'committed',
    retry: isNative
      ? {
        mode: 'idempotency_key',
        replayed,
      }
      : {
        mode: 'not_available_for_legacy_compatibility',
        replayed: false,
      },
    draft_sidecar: preflight
      ? {
        status: 'validated_not_persisted',
        schema_version: preflight.draft_schema_version,
      }
      : {
        status: 'not_present',
      },
  };
}
