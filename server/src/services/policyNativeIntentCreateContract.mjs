/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  validatePolicyInitialDeclaredIntent,
  validatePolicyInitialIntentEstablishmentRequest,
} from './policyInitialIntentEstablishmentContract.mjs';

const NATIVE_INTENT_ESTABLISHMENT_FIELD = 'native_intent_establishment';
const NATIVE_POLICY_CREATE_ALLOWED_FIELDS = Object.freeze([
  'library_id',
  'name',
  NATIVE_INTENT_ESTABLISHMENT_FIELD,
]);

export class PolicyNativeIntentCreateRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PolicyNativeIntentCreateRequestError';
    this.code = 'POLICY_NATIVE_INTENT_CREATE_REQUEST_INVALID';
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizePolicyName(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return normalized && normalized.length <= 255 ? normalized : null;
}

function validateNativePolicyCreateFields(payload) {
  const createPayload = asObject(payload);
  if (!createPayload) {
    throw new PolicyNativeIntentCreateRequestError(
      'Native intent creation requires an object payload.'
    );
  }

  const hasUnexpectedField = Object.keys(createPayload)
    .some(field => !NATIVE_POLICY_CREATE_ALLOWED_FIELDS.includes(field));
  if (hasUnexpectedField) {
    throw new PolicyNativeIntentCreateRequestError(
      'Native intent creation accepts only library_id, name, and native_intent_establishment.'
    );
  }
}

function validateNativePolicyCreateIdentity(payload) {
  validateNativePolicyCreateFields(payload);

  const libraryId = normalizePositiveInteger(payload?.library_id);
  const name = normalizePolicyName(payload?.name);
  if (!libraryId || !name) {
    throw new PolicyNativeIntentCreateRequestError(
      'Native intent creation requires a positive library_id and a policy name of 255 characters or fewer.'
    );
  }

  return { libraryId, name };
}

function buildNativeIntentCreateRequest({
  payload = {},
  actorId,
  idempotencyKey,
  legacyPresetCount = 0,
} = {}) {
  if (payload?.[NATIVE_INTENT_ESTABLISHMENT_FIELD] === undefined) {
    return null;
  }

  validateNativePolicyCreateIdentity(payload);

  if (Number(legacyPresetCount) > 0) {
    throw new PolicyNativeIntentCreateRequestError(
      'Native intent creation cannot be combined with legacy preset attachments.'
    );
  }

  if (!normalizePositiveInteger(actorId)) {
    throw new PolicyNativeIntentCreateRequestError(
      'Native intent creation requires a verified administrator identity.'
    );
  }

  const nativeIntentEstablishment = asObject(payload[NATIVE_INTENT_ESTABLISHMENT_FIELD]);
  if (!nativeIntentEstablishment) {
    throw new PolicyNativeIntentCreateRequestError(
      'native_intent_establishment must be an object containing declared_intent.'
    );
  }

  const keys = Object.keys(nativeIntentEstablishment);
  if (keys.length !== 1 || keys[0] !== 'declared_intent') {
    throw new PolicyNativeIntentCreateRequestError(
      'native_intent_establishment accepts only declared_intent.'
    );
  }

  const declaredIntentValidation = validatePolicyInitialDeclaredIntent(
    nativeIntentEstablishment.declared_intent
  );
  if (!declaredIntentValidation.ok) {
    throw new PolicyNativeIntentCreateRequestError(
      'native_intent_establishment.declared_intent is invalid.'
    );
  }

  const request = validatePolicyInitialIntentEstablishmentRequest({
    schema_version: 1,
    idempotency_key: idempotencyKey,
    declared_intent: declaredIntentValidation.declaredIntent,
  });

  return request;
}

export {
  NATIVE_INTENT_ESTABLISHMENT_FIELD,
  NATIVE_POLICY_CREATE_ALLOWED_FIELDS,
  buildNativeIntentCreateRequest,
  validateNativePolicyCreateIdentity,
};
