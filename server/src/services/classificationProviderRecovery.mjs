/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const PROVIDER_RECOVERY_VERSION = 'provider_recovery.v1';

export const PROVIDER_RECOVERY_MODE_IDS = Object.freeze({
  RETRY_QUEUED: 'retry_queued',
  REVIEW_REQUIRED: 'review_required',
});

const PROVIDER_RECOVERY_MODES = new Set(Object.values(PROVIDER_RECOVERY_MODE_IDS));

/**
 * Produces an intentionally small recovery projection. Transport exceptions
 * can contain credentials, endpoint details, or provider output, so none of
 * those values may cross the classification-result boundary.
 */
export function buildProviderRecovery({ recoveryMode = PROVIDER_RECOVERY_MODE_IDS.REVIEW_REQUIRED } = {}) {
  return Object.freeze({
    version: PROVIDER_RECOVERY_VERSION,
    mode: recoveryMode === PROVIDER_RECOVERY_MODE_IDS.RETRY_QUEUED
      ? PROVIDER_RECOVERY_MODE_IDS.RETRY_QUEUED
      : PROVIDER_RECOVERY_MODE_IDS.REVIEW_REQUIRED,
  });
}

export function getProviderRecoveryMode(result = {}) {
  const recovery = result?.provider_recovery;

  if (recovery?.version !== PROVIDER_RECOVERY_VERSION) {
    return null;
  }

  return PROVIDER_RECOVERY_MODES.has(recovery.mode) ? recovery.mode : null;
}

function hasProviderRecoveryProjection(result = {}) {
  return Boolean(
    result?.provider_recovery
    && typeof result.provider_recovery === 'object'
    && !Array.isArray(result.provider_recovery),
  );
}

export function requiresProviderRecoveryReview(result = {}) {
  return hasProviderRecoveryProjection(result)
    && getProviderRecoveryMode(result) !== PROVIDER_RECOVERY_MODE_IDS.RETRY_QUEUED;
}

/**
 * A provider recovery is not an authority grant. Retry results are already
 * non-final; this separate check also defends callers that skip question
 * normalization before evaluating a route.
 */
export function isProviderRecoveryRoutingBlocked(result = {}) {
  return hasProviderRecoveryProjection(result);
}
