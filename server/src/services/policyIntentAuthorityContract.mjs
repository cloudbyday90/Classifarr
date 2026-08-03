/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { POLICY_INTENT_SOURCES } from './policyIntentSchema.mjs';

const POLICY_INTENT_AUTHORITY_CONTRACT_VERSION = 'policy.intent_authority.v1';
const MAX_AUTHORITY_ISSUES = 32;
const MAX_AUTHORITY_WARNINGS = 32;

const POLICY_INTENT_AUTHORITY_SOURCE_IDS = Object.freeze({
  NATIVE_INTENT: 'native_intent',
  COMPATIBILITY_BRIDGE: 'compatibility_bridge',
});

const POLICY_INTENT_DECLARATION_STATUS_IDS = Object.freeze({
  DECLARED: 'declared',
  NOT_DECLARED: 'not_declared',
  INFERRED_COMPATIBILITY: 'inferred_compatibility',
});

const POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS = Object.freeze({
  AVAILABLE: 'available',
  NOT_CAPTURED: 'not_captured',
  UNAVAILABLE: 'unavailable',
  REDACTED: 'redacted',
});

const POLICY_INTENT_ASK_RULE_STATUS_IDS = Object.freeze({
  NOT_DECLARED: 'not_declared',
  SERVER_DEFAULTS: 'server_defaults',
});

const POLICY_INTENT_ROUTING_TARGET_STATUS_IDS = Object.freeze({
  CONFIGURED: 'configured',
  MISSING: 'missing',
  DISABLED: 'disabled',
  REVIEW_REQUIRED: 'review_required',
  NOT_LOADED: 'not_loaded',
});

const POLICY_INTENT_VALIDATION_STATUS_IDS = Object.freeze({
  VALID: 'valid',
  WARNING: 'warning',
  INVALID: 'invalid',
  UNKNOWN: 'unknown',
});

const POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS = Object.freeze({
  NOT_USED: 'not_used',
  READ_ONLY_COMPATIBILITY_BRIDGE: 'read_only_compatibility_bridge',
});

const VALID_AUTHORITY_SOURCES = new Set(Object.values(POLICY_INTENT_AUTHORITY_SOURCE_IDS));
const VALID_ROUTING_STATUSES = new Set(Object.values(POLICY_INTENT_ROUTING_TARGET_STATUS_IDS));
const VALID_OBSERVED_EVIDENCE_STATUSES = new Set(
  Object.values(POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS)
);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function boundedString(value, maxLength = 160) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized.slice(0, maxLength) : null;
}

function boundedInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function cloneRuleValues(value) {
  const values = asObject(value);
  try {
    return JSON.parse(JSON.stringify(values));
  } catch {
    return {};
  }
}

function normalizeRule(rule = {}) {
  const normalized = asObject(rule);

  return {
    intent_role: boundedString(normalized.intent_role, 40),
    signal_type: boundedString(normalized.signal_type, 80),
    operator: boundedString(normalized.operator, 80),
    values: cloneRuleValues(normalized.values),
    constraint_mode: boundedString(normalized.constraint_mode, 40),
    semantics: boundedString(normalized.semantics, 40),
  };
}

function normalizeRules(value) {
  return asArray(value).map(normalizeRule);
}

function normalizeWarning(warning = {}) {
  const normalized = asObject(warning);

  return {
    reason_code: boundedString(
      normalized.reason_code ?? normalized.reasonId ?? normalized.code,
      100
    ) || 'policy_warning',
    severity: boundedString(normalized.severity, 24) || 'warning',
    summary: boundedString(normalized.summary, 240),
  };
}

function normalizeWarnings(value) {
  return asArray(value)
    .slice(0, MAX_AUTHORITY_WARNINGS)
    .map(normalizeWarning);
}

function normalizeIssueCodes(value) {
  return asArray(value)
    .slice(0, MAX_AUTHORITY_ISSUES)
    .map((issue) => boundedString(
      asObject(issue).code ?? asObject(issue).reason_code ?? asObject(issue).reasonId,
      100
    ))
    .filter(Boolean);
}

function containsRawObservedEvidence(value) {
  try {
    const serialized = JSON.stringify(value || {});
    return ['snapshot_payload', 'evidence_data', 'projection', 'fingerprint']
      .some(forbiddenKey => serialized.includes(`"${forbiddenKey}"`));
  } catch {
    return true;
  }
}

function sourceIdFromRuntimeReadPath(runtimeReadPath = {}) {
  const sourceId = runtimeReadPath?.sourceId ?? runtimeReadPath?.trace?.source;
  if (VALID_AUTHORITY_SOURCES.has(sourceId)) {
    return sourceId;
  }

  return runtimeReadPath?.policy_intent_contract?.source === POLICY_INTENT_SOURCES.NATIVE_INTENT
    ? POLICY_INTENT_AUTHORITY_SOURCE_IDS.NATIVE_INTENT
    : POLICY_INTENT_AUTHORITY_SOURCE_IDS.COMPATIBILITY_BRIDGE;
}

function buildValidationStatus(validation = {}) {
  const normalized = asObject(validation);
  const valid = normalized.valid;
  const errorCount = boundedInteger(normalized.error_count);
  const warningCount = boundedInteger(normalized.warning_count);
  const statusId = valid === false || errorCount > 0
    ? POLICY_INTENT_VALIDATION_STATUS_IDS.INVALID
    : warningCount > 0
      ? POLICY_INTENT_VALIDATION_STATUS_IDS.WARNING
      : valid === true
        ? POLICY_INTENT_VALIDATION_STATUS_IDS.VALID
        : POLICY_INTENT_VALIDATION_STATUS_IDS.UNKNOWN;

  return {
    status_id: statusId,
    error_count: errorCount,
    warning_count: warningCount,
    error_codes: normalizeIssueCodes(normalized.errors),
    warning_codes: normalizeIssueCodes(normalized.warnings),
  };
}

function buildObservedEvidenceReference({ nativeIntent, authorityContext }) {
  if (!nativeIntent) {
    return {
      status_id: POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS.NOT_CAPTURED,
      source_id: null,
      capture_state: null,
      capture_reason_id: null,
      profile_freshness_state: null,
      expires_at: null,
    };
  }

  const reference = asObject(asObject(authorityContext).observed_evidence_reference);
  if (Object.keys(reference).length === 0) {
    return {
      status_id: POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS.NOT_CAPTURED,
      source_id: null,
      capture_state: null,
      capture_reason_id: null,
      profile_freshness_state: null,
      expires_at: null,
    };
  }

  const statusId = reference.payload_redacted === true
    ? POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS.REDACTED
    : reference.capture_state === 'captured'
      ? POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS.AVAILABLE
      : POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS.UNAVAILABLE;

  return {
    status_id: statusId,
    source_id: boundedString(reference.source_id, 80),
    capture_state: boundedString(reference.capture_state, 80),
    capture_reason_id: boundedString(reference.capture_reason_id, 100),
    profile_freshness_state: boundedString(reference.profile_freshness_state, 40),
    expires_at: boundedString(reference.expires_at, 40),
  };
}

function buildRoutingTarget({ nativeIntent, authorityContext }) {
  if (!nativeIntent) {
    return {
      status_id: POLICY_INTENT_ROUTING_TARGET_STATUS_IDS.NOT_LOADED,
      arr_type: null,
    };
  }

  const target = asObject(asObject(authorityContext).routing_target);
  const candidateStatus = boundedString(target.target_status ?? target.status_id, 40);

  return {
    status_id: VALID_ROUTING_STATUSES.has(candidateStatus)
      ? candidateStatus
      : POLICY_INTENT_ROUTING_TARGET_STATUS_IDS.NOT_LOADED,
    arr_type: ['radarr', 'sonarr'].includes(target.arr_type) ? target.arr_type : null,
  };
}

function buildAskRules(reviewBehavior = {}) {
  return {
    status_id: reviewBehavior.require_ai_validation === true
      ? POLICY_INTENT_ASK_RULE_STATUS_IDS.SERVER_DEFAULTS
      : POLICY_INTENT_ASK_RULE_STATUS_IDS.NOT_DECLARED,
    rules: [],
  };
}

function buildPolicyIntentAuthorityContract({
  policy = {},
  runtimeReadPath = {},
  authorityContext = null,
} = {}) {
  const intentContract = asObject(runtimeReadPath.policy_intent_contract);
  const sourceId = sourceIdFromRuntimeReadPath(runtimeReadPath);
  const nativeIntent = sourceId === POLICY_INTENT_AUTHORITY_SOURCE_IDS.NATIVE_INTENT;
  const validationStatus = buildValidationStatus(intentContract.validation);
  const purpose = normalizeRules(intentContract.purpose);
  const helpfulMatches = normalizeRules(intentContract.helpful_hints);
  const hardLimits = normalizeRules(intentContract.hard_limits);
  const avoidRules = normalizeRules(intentContract.avoid);

  return {
    version: POLICY_INTENT_AUTHORITY_CONTRACT_VERSION,
    policy: {
      id: policy.id ?? intentContract.policy_id ?? null,
      library_id: policy.library_id ?? intentContract.library_id ?? null,
    },
    authority: {
      source_id: sourceId,
      status_id: boundedString(runtimeReadPath.statusId ?? runtimeReadPath.trace?.status, 80),
      authoritative: nativeIntent && validationStatus.status_id !== POLICY_INTENT_VALIDATION_STATUS_IDS.INVALID,
    },
    declared_intent: {
      status_id: nativeIntent
        ? POLICY_INTENT_DECLARATION_STATUS_IDS.DECLARED
        : POLICY_INTENT_DECLARATION_STATUS_IDS.NOT_DECLARED,
      purpose: nativeIntent ? purpose : [],
      helpful_matches: nativeIntent ? helpfulMatches : [],
    },
    observed_evidence_reference: buildObservedEvidenceReference({
      nativeIntent,
      authorityContext,
    }),
    hard_limits: {
      status_id: nativeIntent
        ? POLICY_INTENT_DECLARATION_STATUS_IDS.DECLARED
        : POLICY_INTENT_DECLARATION_STATUS_IDS.INFERRED_COMPATIBILITY,
      rules: hardLimits,
    },
    avoid_rules: {
      status_id: nativeIntent
        ? POLICY_INTENT_DECLARATION_STATUS_IDS.DECLARED
        : POLICY_INTENT_DECLARATION_STATUS_IDS.INFERRED_COMPATIBILITY,
      rules: avoidRules,
    },
    ask_rules: buildAskRules(asObject(intentContract.review_behavior)),
    routing_target: buildRoutingTarget({
      nativeIntent,
      authorityContext,
    }),
    warnings: normalizeWarnings(intentContract.warnings),
    validation_status: validationStatus,
    legacy_projection: {
      status_id: nativeIntent
        ? POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS.NOT_USED
        : POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS.READ_ONLY_COMPATIBILITY_BRIDGE,
      final_authority: false,
    },
  };
}

function validatePolicyIntentAuthorityContract(contract = {}) {
  const candidate = asObject(contract);
  const errors = [];
  const sourceId = candidate.authority?.source_id;
  const legacyProjectionStatus = candidate.legacy_projection?.status_id;
  const observedEvidenceStatus = candidate.observed_evidence_reference?.status_id;

  if (candidate.version !== POLICY_INTENT_AUTHORITY_CONTRACT_VERSION) {
    errors.push({ code: 'unsupported_version', path: 'version' });
  }

  if (!VALID_AUTHORITY_SOURCES.has(sourceId)) {
    errors.push({ code: 'unknown_authority_source', path: 'authority.source_id' });
  }

  if (!candidate.policy || typeof candidate.policy !== 'object') {
    errors.push({ code: 'invalid_policy_reference', path: 'policy' });
  }

  for (const key of [
    'declared_intent',
    'observed_evidence_reference',
    'hard_limits',
    'avoid_rules',
    'ask_rules',
    'routing_target',
    'validation_status',
    'legacy_projection',
  ]) {
    if (!candidate[key] || typeof candidate[key] !== 'object' || Array.isArray(candidate[key])) {
      errors.push({ code: 'missing_contract_section', path: key });
    }
  }

  if (!Array.isArray(candidate.warnings)) {
    errors.push({ code: 'invalid_warnings', path: 'warnings' });
  }

  if (!VALID_OBSERVED_EVIDENCE_STATUSES.has(observedEvidenceStatus)) {
    errors.push({ code: 'unknown_observed_evidence_status', path: 'observed_evidence_reference.status_id' });
  }

  if (!VALID_ROUTING_STATUSES.has(candidate.routing_target?.status_id)) {
    errors.push({ code: 'unknown_routing_target_status', path: 'routing_target.status_id' });
  }

  if (sourceId === POLICY_INTENT_AUTHORITY_SOURCE_IDS.COMPATIBILITY_BRIDGE) {
    if (candidate.authority?.authoritative !== false) {
      errors.push({ code: 'compatibility_bridge_marked_authoritative', path: 'authority.authoritative' });
    }
    if (legacyProjectionStatus !== POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS.READ_ONLY_COMPATIBILITY_BRIDGE) {
      errors.push({ code: 'compatibility_bridge_not_read_only', path: 'legacy_projection.status_id' });
    }
  }

  if (sourceId === POLICY_INTENT_AUTHORITY_SOURCE_IDS.NATIVE_INTENT &&
      legacyProjectionStatus !== POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS.NOT_USED) {
    errors.push({ code: 'native_authority_uses_legacy_projection', path: 'legacy_projection.status_id' });
  }

  if (containsRawObservedEvidence(candidate.observed_evidence_reference)) {
    errors.push({
      code: 'raw_observed_evidence_exposed',
      path: 'observed_evidence_reference',
    });
  }

  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

export {
  POLICY_INTENT_ASK_RULE_STATUS_IDS,
  POLICY_INTENT_AUTHORITY_CONTRACT_VERSION,
  POLICY_INTENT_AUTHORITY_SOURCE_IDS,
  POLICY_INTENT_DECLARATION_STATUS_IDS,
  POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS,
  POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS,
  POLICY_INTENT_ROUTING_TARGET_STATUS_IDS,
  POLICY_INTENT_VALIDATION_STATUS_IDS,
  buildPolicyIntentAuthorityContract,
  validatePolicyIntentAuthorityContract,
};
