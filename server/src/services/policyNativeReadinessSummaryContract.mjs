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
  getPolicyAutomationReadinessState,
} from './policyAutomationReadinessEngine.mjs';

const POLICY_NATIVE_READINESS_SUMMARY_VERSION = 'policy.native_readiness_summary.v1';
const MAX_REASON_CODES = 8;
const MAX_ACTION_LABEL_LENGTH = 160;

const POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS = Object.freeze({
  AVAILABLE: 'native_policy_readiness_available',
  POLICY_NOT_FOUND: 'native_policy_readiness_policy_not_found',
  NATIVE_INTENT_UNAVAILABLE: 'native_policy_readiness_native_intent_unavailable',
  READ_UNAVAILABLE: 'native_policy_readiness_unavailable',
});

const POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_native_readiness_summary_version',
  INVALID_POLICY: 'invalid_native_readiness_summary_policy',
  INVALID_NATIVE_INTENT: 'invalid_native_readiness_summary_native_intent',
  INVALID_READINESS: 'invalid_native_readiness_summary_readiness',
  UNSAFE_SIDE_EFFECT: 'unsafe_native_readiness_summary_side_effect',
  RAW_PAYLOAD_EXPOSED: 'raw_native_readiness_summary_payload_exposed',
  INVALID_AUTHORITY: 'invalid_native_readiness_summary_authority',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeString(value, maximumLength = MAX_ACTION_LABEL_LENGTH) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeReasonCodes(value) {
  return [...new Set(asArray(value)
    .map(reasonCode => normalizeString(reasonCode, 120))
    .filter(Boolean))]
    .slice(0, MAX_REASON_CODES);
}

function buildAuthority() {
  return {
    displayProjection: true,
    automationDecision: false,
    policyPersistence: false,
    routingExecution: false,
  };
}

function buildSideEffects({
  storedPolicyRead = false,
  storedNativeIntentRead = false,
  cachedProfileRead = false,
  routingConfigurationRead = false,
} = {}) {
  return {
    storedPolicyRead,
    storedNativeIntentRead,
    cachedProfileRead,
    routingConfigurationRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
    routingExecuted: false,
  };
}

function buildBaseResult({
  statusId,
  policyId = null,
  nativeIntent = null,
  readiness = null,
  sideEffects,
} = {}) {
  return {
    version: POLICY_NATIVE_READINESS_SUMMARY_VERSION,
    statusId,
    policyId: normalizePositiveInteger(policyId),
    nativeIntent,
    readiness,
    authority: buildAuthority(),
    sideEffects: buildSideEffects(sideEffects),
    rawPayloadExposed: false,
  };
}

function buildUnavailableNativeIntent({ authority = {}, intentVersion = null } = {}) {
  const source = asObject(authority);

  return {
    authorityStateId: normalizeString(source.stateId, 120) || 'unknown_native_intent_authority',
    authoritative: false,
    intentVersion: normalizePositiveInteger(intentVersion),
    purposeRuleCount: 0,
    validationStateId: 'unavailable',
  };
}

function buildNativeIntentSummary({ nativeIntent = {}, nativeContract = {} } = {}) {
  const authority = asObject(nativeIntent.authority);
  const intent = asObject(nativeIntent.intent);
  const contract = asObject(nativeContract);
  const purposeRuleCount = asArray(contract.purpose).length;

  return {
    authorityStateId: normalizeString(authority.stateId, 120) || 'unknown_native_intent_authority',
    authoritative: authority.authoritative === true,
    intentVersion: normalizePositiveInteger(intent.intent_version),
    purposeRuleCount,
    validationStateId: contract.validation?.valid === true ? 'valid' : 'invalid',
  };
}

function buildReadinessSummary(readiness = {}) {
  const source = asObject(readiness);
  const state = getPolicyAutomationReadinessState(source.stateId);
  const nextAction = asObject(source.nextAction);
  const actionId = normalizeString(nextAction.actionId, 120);
  const actionLabel = normalizeString(nextAction.label);

  if (
    !state ||
    typeof source.ready !== 'boolean' ||
    source.ready !== (state.id === 'ready') ||
    !actionId ||
    !actionLabel
  ) {
    return null;
  }

  return {
    stateId: state.id,
    label: state.label,
    ready: source.ready,
    nextAction: {
      actionId,
      label: actionLabel,
    },
    reasonCodes: normalizeReasonCodes(source.reasonCodes),
  };
}

function buildPolicyNotFoundResult(policyId = null) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.POLICY_NOT_FOUND,
    policyId,
    sideEffects: { storedPolicyRead: true },
  });
}

function buildNativeIntentUnavailableResult({
  policyId = null,
  authority = {},
  intentVersion = null,
  sideEffects = {},
} = {}) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.NATIVE_INTENT_UNAVAILABLE,
    policyId,
    nativeIntent: buildUnavailableNativeIntent({ authority, intentVersion }),
    sideEffects: {
      storedPolicyRead: true,
      storedNativeIntentRead: true,
      ...sideEffects,
    },
  });
}

function buildReadUnavailableResult({ policyId = null, sideEffects = {} } = {}) {
  return buildBaseResult({
    statusId: POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.READ_UNAVAILABLE,
    policyId,
    sideEffects: {
      storedPolicyRead: true,
      ...sideEffects,
    },
  });
}

function buildAvailableNativeReadinessSummary({
  policyId = null,
  nativeIntent = {},
  nativeContract = {},
  readiness = {},
  sideEffects = {},
} = {}) {
  const boundedReadiness = buildReadinessSummary(readiness);
  if (!boundedReadiness) {
    return buildReadUnavailableResult({ policyId, sideEffects });
  }

  return buildBaseResult({
    statusId: POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.AVAILABLE,
    policyId,
    nativeIntent: buildNativeIntentSummary({ nativeIntent, nativeContract }),
    readiness: boundedReadiness,
    sideEffects: {
      storedPolicyRead: true,
      storedNativeIntentRead: true,
      ...sideEffects,
    },
  });
}

function buildPolicyNativeReadinessSummaryAudit(result = {}) {
  const source = asObject(result);
  const sideEffects = asObject(source.sideEffects);
  const authority = asObject(source.authority);
  const issues = [];

  if (source.version !== POLICY_NATIVE_READINESS_SUMMARY_VERSION) {
    issues.push({
      riskId: POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS.INVALID_VERSION,
      message: 'Native readiness summaries must use the current contract version.',
    });
  }

  if (!normalizePositiveInteger(source.policyId)) {
    issues.push({
      riskId: POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS.INVALID_POLICY,
      message: 'Native readiness summaries require a positive policy ID.',
    });
  }

  if (
    authority.displayProjection !== true ||
    authority.automationDecision !== false ||
    authority.policyPersistence !== false ||
    authority.routingExecution !== false
  ) {
    issues.push({
      riskId: POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS.INVALID_AUTHORITY,
      message: 'Native readiness summaries are display-only and cannot authorize automation, writes, or routing.',
    });
  }

  if (source.statusId === POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.AVAILABLE) {
    const nativeIntent = asObject(source.nativeIntent);
    const readiness = asObject(source.readiness);
    const state = getPolicyAutomationReadinessState(readiness.stateId);

    if (
      nativeIntent.authoritative !== true ||
      !normalizePositiveInteger(nativeIntent.intentVersion) ||
      !Number.isInteger(nativeIntent.purposeRuleCount) ||
      nativeIntent.purposeRuleCount <= 0 ||
      !['valid', 'invalid'].includes(nativeIntent.validationStateId)
    ) {
      issues.push({
        riskId: POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS.INVALID_NATIVE_INTENT,
        message: 'Available native readiness requires one authoritative stored native intent with purpose rules.',
      });
    }

    if (
      !state ||
      typeof readiness.ready !== 'boolean' ||
      readiness.ready !== (state.id === 'ready') ||
      normalizeString(readiness.label) !== state.label ||
      !normalizeString(readiness.nextAction?.actionId, 120) ||
      !normalizeString(readiness.nextAction?.label) ||
      normalizeReasonCodes(readiness.reasonCodes).length === 0
    ) {
      issues.push({
        riskId: POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS.INVALID_READINESS,
        message: 'Available native readiness requires one bounded readiness state and next action.',
      });
    }
  }

  if (
    sideEffects.liveMediaServerLookupPerformed !== false ||
    sideEffects.liveProviderLookupPerformed !== false ||
    sideEffects.providerQuotaRead !== false ||
    sideEffects.policyStorageMutated !== false ||
    sideEffects.routingExecuted !== false
  ) {
    issues.push({
      riskId: POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Native readiness summaries must not perform live lookups, quota reads, writes, or routing.',
    });
  }

  if (source.rawPayloadExposed !== false) {
    issues.push({
      riskId: POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      message: 'Native readiness summaries must not expose raw policy, provider, or diagnostic payloads.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_NATIVE_READINESS_SUMMARY_RISK_IDS,
  POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS,
  POLICY_NATIVE_READINESS_SUMMARY_VERSION,
  buildAvailableNativeReadinessSummary,
  buildNativeIntentUnavailableResult,
  buildPolicyNativeReadinessSummaryAudit,
  buildPolicyNotFoundResult,
  buildReadUnavailableResult,
  normalizePositiveInteger,
};
