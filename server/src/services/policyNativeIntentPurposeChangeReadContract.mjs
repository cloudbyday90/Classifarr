/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_VERSION =
  'policy.native_intent_purpose_change_read.v1';

const POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS = Object.freeze({
  AVAILABLE: 'native_intent_purpose_change_available',
  POLICY_NOT_FOUND: 'native_intent_purpose_change_policy_not_found',
  AUTHORITY_UNAVAILABLE: 'native_intent_purpose_change_authority_unavailable',
  READ_UNAVAILABLE: 'native_intent_purpose_change_unavailable',
});

const POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_native_intent_purpose_change_read_version',
  INVALID_POLICY: 'invalid_native_intent_purpose_change_read_policy',
  INVALID_AUTHORITY: 'invalid_native_intent_purpose_change_read_authority',
  INVALID_REVISION: 'invalid_native_intent_purpose_change_read_revision',
  INVALID_COMMAND: 'invalid_native_intent_purpose_change_read_command',
  UNSAFE_SIDE_EFFECT: 'unsafe_native_intent_purpose_change_read_side_effect',
  UNSAFE_PROJECTION: 'unsafe_native_intent_purpose_change_read_projection',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function buildSideEffects({
  storedPolicyRead = false,
  storedNativeIntentRead = false,
} = {}) {
  return {
    storedPolicyRead,
    storedNativeIntentRead,
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
  revision = null,
  changeCommand = null,
  sideEffects = {},
} = {}) {
  return {
    version: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_VERSION,
    statusId,
    policyId: asPositiveInteger(policyId),
    revision: asPositiveInteger(revision),
    changeCommand,
    authority: {
      source: 'server_owned_native_intent',
      purposeChangeAllowed: statusId === POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AVAILABLE,
      browserAuthorityAccepted: false,
    },
    sideEffects: buildSideEffects(sideEffects),
    compatibilityDataExposed: false,
    aiDataExposed: false,
    routingDataExposed: false,
    learningDataExposed: false,
  };
}

function buildPurposeChangeAvailableResult({ policyId, revision, changeCommand } = {}) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AVAILABLE,
    policyId,
    revision,
    changeCommand,
    sideEffects: {
      storedPolicyRead: true,
      storedNativeIntentRead: true,
    },
  });
}

function buildPurposeChangePolicyNotFoundResult(policyId = null) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.POLICY_NOT_FOUND,
    policyId,
    sideEffects: { storedPolicyRead: true },
  });
}

function buildPurposeChangeAuthorityUnavailableResult({ policyId, revision = null } = {}) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AUTHORITY_UNAVAILABLE,
    policyId,
    revision,
    sideEffects: {
      storedPolicyRead: true,
      storedNativeIntentRead: true,
    },
  });
}

function buildPurposeChangeReadUnavailableResult(policyId = null) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.READ_UNAVAILABLE,
    policyId,
    sideEffects: { storedPolicyRead: true },
  });
}

function validatePolicyNativeIntentPurposeChangeRead(result = {}) {
  const source = asObject(result);
  const authority = asObject(source.authority);
  const sideEffects = asObject(source.sideEffects);
  const issues = [];

  if (source.version !== POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_VERSION) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS.INVALID_VERSION,
      message: 'Native purpose-change reads must use the supported contract version.',
    });
  }

  if (!asPositiveInteger(source.policyId)) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS.INVALID_POLICY,
      message: 'Native purpose-change reads require a positive policy identifier.',
    });
  }

  if (
    authority.source !== 'server_owned_native_intent' ||
    authority.browserAuthorityAccepted !== false ||
    authority.purposeChangeAllowed !== (
      source.statusId === POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AVAILABLE
    )
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS.INVALID_AUTHORITY,
      message: 'Native purpose-change reads must identify server-owned authority only.',
    });
  }

  if (source.statusId === POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AVAILABLE) {
    if (!asPositiveInteger(source.revision)) {
      issues.push({
        riskId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS.INVALID_REVISION,
        message: 'Available native purpose-change reads require an active revision.',
      });
    }

    const command = asObject(source.changeCommand);
    if (command.command_id !== 'update_purpose' || !Array.isArray(command.values) || command.values.length === 0) {
      issues.push({
        riskId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS.INVALID_COMMAND,
        message: 'Available native purpose-change reads require one non-empty typed purpose command.',
      });
    }
  }

  if (
    sideEffects.providerAccessed !== false ||
    sideEffects.policyStorageMutated !== false ||
    sideEffects.routingAffected !== false ||
    sideEffects.learningAffected !== false ||
    sideEffects.databaseWritten !== false
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Native purpose-change reads must not call providers or mutate policy, routing, learning, or storage.',
    });
  }

  if (
    source.compatibilityDataExposed !== false ||
    source.aiDataExposed !== false ||
    source.routingDataExposed !== false ||
    source.learningDataExposed !== false
  ) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS.UNSAFE_PROJECTION,
      message: 'Native purpose-change reads must not project compatibility, AI, routing, or learning data.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_RISK_IDS,
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS,
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_VERSION,
  buildPurposeChangeAuthorityUnavailableResult,
  buildPurposeChangeAvailableResult,
  buildPurposeChangePolicyNotFoundResult,
  buildPurposeChangeReadUnavailableResult,
  validatePolicyNativeIntentPurposeChangeRead,
};
