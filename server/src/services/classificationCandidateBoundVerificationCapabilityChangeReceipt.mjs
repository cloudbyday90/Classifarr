/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS,
  CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS,
  buildCandidateBoundVerificationProviderPreflight,
  getCandidateBoundVerificationProviderPreflightStatusPresentation,
} from './classificationCandidateBoundVerificationProviderPreflight.mjs';
import {
  isAiVerificationCapabilityChangeReceiptActorId,
} from './aiVerificationCapabilityChangeReceiptActorIdentity.mjs';

export const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_VERSION =
  'classification.candidate_bound_verification_capability_change_receipt.v1';

const STATUS_IDS = /** @type {Set<string>} */ (new Set(Object.values(
  CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS,
)));

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function isCandidateBoundVerificationCapabilityStatusId(value) {
  return typeof value === 'string' && STATUS_IDS.has(value);
}

function resolveStatusId(configuration) {
  return buildCandidateBoundVerificationProviderPreflight({
    existingConfiguration: configuration,
  }).statusId;
}

/**
 * Builds the minimal auditable projection of a persisted capability transition.
 * This deliberately excludes the configuration values used to derive the
 * statuses, including provider identity, model, endpoint, and credentials.
 */
/**
 * @param {{
 *   beforeConfiguration?: Record<string, unknown> | null,
 *   afterConfiguration?: Record<string, unknown> | null,
 *   actorId?: unknown,
 *   configurationRevision?: unknown,
 * }} options
 */
export function buildCandidateBoundVerificationCapabilityChangeReceipt(options = {}) {
  const {
    beforeConfiguration,
    afterConfiguration,
    actorId,
    configurationRevision,
  } = options;
  if (!isAiVerificationCapabilityChangeReceiptActorId(actorId)) {
    throw new TypeError('Verification capability change receipt actor ID is invalid.');
  }
  if (!isPositiveSafeInteger(configurationRevision)) {
    throw new TypeError('Verification capability change receipt configuration revision is invalid.');
  }

  const beforeStatusId = resolveStatusId(beforeConfiguration);
  const afterStatusId = resolveStatusId(afterConfiguration);

  if (beforeStatusId === afterStatusId) {
    return null;
  }

  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_VERSION,
    actorId,
    beforeStatusId,
    afterStatusId,
    configurationRevision,
  });
}

/**
 * Projects a persisted receipt status through fixed server-owned language.
 */
export function getCandidateBoundVerificationCapabilityReceiptStatus(statusId) {
  if (!isCandidateBoundVerificationCapabilityStatusId(statusId)) {
    throw new TypeError('Verification capability change receipt status ID is invalid.');
  }

  const presentation = getCandidateBoundVerificationProviderPreflightStatusPresentation(
    statusId,
    CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS.SAVED_CONFIGURATION,
  );

  return Object.freeze({
    statusId,
    label: presentation.label,
  });
}
