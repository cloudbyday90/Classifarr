/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_VERSION =
  'policy.native_intent_change_recent_receipt_discovery.v1';

const POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_MAX_AGE_SECONDS = 60 * 60;

const POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS = Object.freeze({
  COMPLETE: 'native_intent_change_recent_receipt_discovery_complete',
  UNAVAILABLE: 'native_intent_change_recent_receipt_discovery_unavailable',
});

const POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_native_intent_change_recent_receipt_discovery_version',
  INVALID_POLICY: 'invalid_native_intent_change_recent_receipt_discovery_policy',
  INVALID_STATUS: 'invalid_native_intent_change_recent_receipt_discovery_status',
  INVALID_RECENT_CHANGE: 'invalid_native_intent_change_recent_receipt_discovery_recent_change',
  UNSAFE_SIDE_EFFECT: 'unsafe_native_intent_change_recent_receipt_discovery_side_effect',
  UNSAFE_PROJECTION: 'unsafe_native_intent_change_recent_receipt_discovery_projection',
});

const DISCOVERY_RESULT_KEYS = Object.freeze([
  'version',
  'statusId',
  'mode',
  'policyId',
  'recentChange',
  'scope',
  'sideEffects',
  'idempotencyKeyExposed',
  'commandFingerprintExposed',
  'commandValuesExposed',
  'receiptHistoryExposed',
  'receiptIdentifierExposed',
  'receiptTimestampExposed',
  'rawPolicyDataExposed',
  'compatibilityDataExposed',
  'aiDataExposed',
  'routingDataExposed',
  'learningDataExposed',
]);

const DISCOVERY_SCOPE_KEYS = Object.freeze([
  'actorBound',
  'policyBound',
  'browserAuthorityAccepted',
  'mutationAuthorized',
]);

const DISCOVERY_SIDE_EFFECT_KEYS = Object.freeze([
  'storedReceiptRead',
  'providerAccessed',
  'policyStorageMutated',
  'routingAffected',
  'learningAffected',
  'databaseWritten',
]);

const RECENT_CHANGE_KEYS = Object.freeze([
  'resultStatusId',
  'sourceIntentVersion',
  'targetIntentVersion',
]);

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value) {
  return isPlainObject(value) ? value : {};
}

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function hasOnlyKeys(value, allowedKeys) {
  return isPlainObject(value) && Object.keys(value).every(key => allowedKeys.includes(key));
}

function buildSideEffects({ storedReceiptRead = false } = {}) {
  return {
    storedReceiptRead,
    providerAccessed: false,
    policyStorageMutated: false,
    routingAffected: false,
    learningAffected: false,
    databaseWritten: false,
  };
}

function buildBaseResult({
  statusId,
  policyId = null,
  recentChange = null,
  sideEffects = {},
} = {}) {
  return {
    version: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_VERSION,
    statusId,
    mode: 'read_only',
    policyId: asPositiveInteger(policyId),
    recentChange,
    scope: {
      actorBound: true,
      policyBound: true,
      browserAuthorityAccepted: false,
      mutationAuthorized: false,
    },
    sideEffects: buildSideEffects(sideEffects),
    idempotencyKeyExposed: false,
    commandFingerprintExposed: false,
    commandValuesExposed: false,
    receiptHistoryExposed: false,
    receiptIdentifierExposed: false,
    receiptTimestampExposed: false,
    rawPolicyDataExposed: false,
    compatibilityDataExposed: false,
    aiDataExposed: false,
    routingDataExposed: false,
    learningDataExposed: false,
  };
}

function buildRecentChange(value = {}) {
  const sourceIntentVersion = asPositiveInteger(value.sourceIntentVersion ?? value.source_intent_version);
  const targetIntentVersion = asPositiveInteger(value.targetIntentVersion ?? value.target_intent_version);
  const resultStatusId = value.resultStatusId ?? value.result_status_id;

  if (
    resultStatusId !== 'applied' ||
    !sourceIntentVersion ||
    !targetIntentVersion ||
    targetIntentVersion <= sourceIntentVersion
  ) {
    return null;
  }

  return {
    resultStatusId: 'applied',
    sourceIntentVersion,
    targetIntentVersion,
  };
}

function buildRecentReceiptDiscoveryCompleteResult({ policyId, recentChange = null } = {}) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.COMPLETE,
    policyId,
    recentChange: recentChange === null ? null : buildRecentChange(recentChange),
    sideEffects: { storedReceiptRead: true },
  });
}

function buildRecentReceiptDiscoveryUnavailableResult(policyId = null) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.UNAVAILABLE,
    policyId,
  });
}

function validatePolicyNativeIntentChangeRecentReceiptDiscovery(result = {}) {
  const source = asObject(result);
  const scope = asObject(source.scope);
  const sideEffects = asObject(source.sideEffects);
  const issues = [];

  if (
    !hasOnlyKeys(result, DISCOVERY_RESULT_KEYS) ||
    !hasOnlyKeys(source.scope, DISCOVERY_SCOPE_KEYS) ||
    !hasOnlyKeys(source.sideEffects, DISCOVERY_SIDE_EFFECT_KEYS) ||
    (source.recentChange !== null && !hasOnlyKeys(source.recentChange, RECENT_CHANGE_KEYS))
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS.UNSAFE_PROJECTION,
      message: 'Recent receipt discovery must use the fixed allow-listed response projection.',
    });
  }

  if (source.version !== POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_VERSION) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS.INVALID_VERSION,
      message: 'Recent native intent receipt discovery must use the supported contract version.',
    });
  }

  if (!asPositiveInteger(source.policyId)) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS.INVALID_POLICY,
      message: 'Recent native intent receipt discovery requires a positive policy identifier.',
    });
  }

  if (
    source.mode !== 'read_only' ||
    !Object.values(POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS)
      .includes(source.statusId) ||
    scope.actorBound !== true ||
    scope.policyBound !== true ||
    scope.browserAuthorityAccepted !== false ||
    scope.mutationAuthorized !== false
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS.INVALID_STATUS,
      message: 'Recent receipt discovery must remain actor-bound, policy-bound, and read-only.',
    });
  }

  if (
    (source.statusId === POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.COMPLETE &&
      source.recentChange !== null &&
      buildRecentChange(source.recentChange) === null) ||
    (source.statusId === POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.UNAVAILABLE &&
      source.recentChange !== null)
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS.INVALID_RECENT_CHANGE,
      message: 'Recent receipt discovery must expose only a coherent applied revision transition.',
    });
  }

  if (
    sideEffects.providerAccessed !== false ||
    sideEffects.policyStorageMutated !== false ||
    sideEffects.routingAffected !== false ||
    sideEffects.learningAffected !== false ||
    sideEffects.databaseWritten !== false
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Recent receipt discovery must not call providers or mutate policy, routing, learning, or storage.',
    });
  }

  if (
    (source.statusId === POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.COMPLETE &&
      sideEffects.storedReceiptRead !== true) ||
    (source.statusId === POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.UNAVAILABLE &&
      sideEffects.storedReceiptRead !== false)
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Recent receipt discovery must report only the actual bounded receipt-read side effect.',
    });
  }

  if (
    source.idempotencyKeyExposed !== false ||
    source.commandFingerprintExposed !== false ||
    source.commandValuesExposed !== false ||
    source.receiptHistoryExposed !== false ||
    source.receiptIdentifierExposed !== false ||
    source.receiptTimestampExposed !== false ||
    source.rawPolicyDataExposed !== false ||
    source.compatibilityDataExposed !== false ||
    source.aiDataExposed !== false ||
    source.routingDataExposed !== false ||
    source.learningDataExposed !== false
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS.UNSAFE_PROJECTION,
      message: 'Recent receipt discovery must expose only fixed status and revision facts.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_RISK_IDS,
  POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS,
  POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_VERSION,
  POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_MAX_AGE_SECONDS,
  buildRecentChange,
  buildRecentReceiptDiscoveryCompleteResult,
  buildRecentReceiptDiscoveryUnavailableResult,
  validatePolicyNativeIntentChangeRecentReceiptDiscovery,
};
