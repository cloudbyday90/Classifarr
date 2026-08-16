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
  normalizePolicyNativeIntentChangePurposeCommand,
} from './policyNativeIntentChangePurposePreflightContract.mjs';

const POLICY_NATIVE_INTENT_CHANGE_ADMISSION_VERSION =
  'policy.native_intent_change_admission.v1';

const POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS = Object.freeze({
  UPDATE_PURPOSE: 'update_purpose',
  UPDATE_HARD_LIMITS: 'update_hard_limits',
  UPDATE_AVOID_RULES: 'update_avoid_rules',
  UPDATE_HELPFUL_MATCHES: 'update_helpful_matches',
  UPDATE_ROUTING_TARGET: 'update_routing_target',
  UPDATE_REVIEW_TRIGGERS: 'update_review_triggers',
});

const POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS = Object.freeze({
  ADMITTED: 'admitted',
  STALE_REVISION: 'stale_revision',
  POLICY_REPLACED: 'policy_replaced',
  RECOVERY_REQUIRED: 'recovery_required',
  AUTHORIZATION_REJECTED: 'authorization_rejected',
  UNAVAILABLE_AUTHORITY: 'unavailable_authority',
  UNKNOWN_COMMAND: 'unknown_command',
  RETRYABLE: 'retryable',
});

const POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS = Object.freeze({
  UNAUTHORIZED_ACTOR: 'unauthorized_actor',
  MISSING_ACTOR_ID: 'missing_actor_id',
  MISSING_POLICY_ID: 'missing_policy_id',
  MISSING_EXPECTED_REVISION: 'missing_expected_revision',
  REVISION_MISMATCH: 'revision_mismatch',
  NEWER_VERSION_ACTIVE: 'newer_version_active',
  NO_ACTIVE_AUTHORITY: 'no_active_authority',
  AMBIGUOUS_AUTHORITY: 'ambiguous_authority',
  NON_AUTHORITATIVE_AUTHORITY: 'non_authoritative_authority',
  EMPTY_CHANGE_COMMANDS: 'empty_change_commands',
  UNKNOWN_CHANGE_COMMAND: 'unknown_change_command',
  INVALID_CHANGE_COMMAND: 'invalid_change_command',
  LEGACY_FIELD_DETECTED: 'legacy_field_detected',
  ESTABLISHMENT_FIELD_DETECTED: 'establishment_field_detected',
  INVALID_IDEMPOTENCY_KEY: 'invalid_idempotency_key',
  VERSION_MISMATCH: 'version_mismatch',
  DERIVED_STATUS_MISMATCH: 'derived_status_mismatch',
  ADMITTED_WITH_RISKS: 'admitted_with_risks',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const ALLOWED_CHANGE_COMMAND_IDS = Object.freeze(
  Object.values(POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS),
);

const LEGACY_FIELD_NAMES = Object.freeze([
  'customSignals',
  'custom_signals',
  'signals',
  'presetWeights',
  'preset_weights',
  'decisionThreshold',
  'decision_threshold',
  'combinationMode',
  'combination_mode',
  'configuration_view',
  'configurationView',
  'selectedPresets',
  'selected_presets',
]);

const ESTABLISHMENT_FIELD_NAMES = Object.freeze([
  'native_intent_establishment',
  'nativeIntentEstablishment',
]);

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$/u;

const RECOVERY_STATUS_IDS = Object.freeze([
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RECOVERY_REQUIRED,
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.UNAVAILABLE_AUTHORITY,
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.POLICY_REPLACED,
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function buildRisk(riskId, message, metadata = null) {
  return {
    riskId,
    message,
    ...(metadata ? { metadata } : {}),
  };
}

function validateIdempotencyKey(key) {
  const normalized = normalizeString(key);
  if (!normalized) return null;
  return IDEMPOTENCY_KEY_PATTERN.test(normalized) ? normalized : false;
}

function detectLegacyFields(payload) {
  const normalized = asObject(payload);
  const detected = [];

  LEGACY_FIELD_NAMES.forEach(field => {
    if (Object.hasOwn(normalized, field)) {
      detected.push(field);
    }
  });

  ESTABLISHMENT_FIELD_NAMES.forEach(field => {
    if (Object.hasOwn(normalized, field)) {
      detected.push(field);
    }
  });

  return detected;
}

function validateChangeCommands(commands) {
  const normalized = asArray(commands).map(cmd => asObject(cmd));
  const validated = [];
  const unknown = [];
  const invalid = [];

  normalized.forEach(cmd => {
    const commandId = normalizeString(cmd.commandId ?? cmd.command_id ?? cmd.id);
    if (commandId === POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_PURPOSE) {
      try {
        const purposeCommand = normalizePolicyNativeIntentChangePurposeCommand({
          command_id: commandId,
          values: cmd.values ?? cmd.payload ?? cmd.data,
        });
        validated.push({
          commandId,
          values: purposeCommand.values,
        });
      } catch {
        invalid.push(commandId);
      }
    } else if (ALLOWED_CHANGE_COMMAND_IDS.includes(commandId)) {
      validated.push({
        commandId,
        values: asArray(cmd.values ?? cmd.payload ?? cmd.data),
      });
    } else if (commandId) {
      unknown.push(commandId);
    }
  });

  return { validated, unknown, invalid };
}

function buildPolicyNativeIntentChangeAdmission({
  policyId,
  expectedRevision,
  actorId,
  actorRole,
  idempotencyKey,
  changeCommands = [],
  authorityState = {},
  legacyPayload = null,
} = {}) {
  const risks = [];
  const normalizedPolicyId = normalizePositiveInteger(policyId);
  const normalizedActorId = normalizePositiveInteger(actorId);
  const normalizedExpectedRevision = normalizePositiveInteger(expectedRevision);
  const normalizedActorRole = normalizeString(actorRole);
  const authority = asObject(authorityState);
  const currentRevision = normalizePositiveInteger(authority.currentRevision ??
    authority.intentVersion ?? authority.intent_version);
  const authorityStatusId = normalizeString(authority.stateId ?? authority.statusId);

  if (!normalizedPolicyId) {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.MISSING_POLICY_ID,
      'Native intent change requires a positive policy identifier derived from the route.',
    ));
  }

  if (!normalizedActorId) {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.MISSING_ACTOR_ID,
      'Native intent change requires an authenticated administrator actor.',
    ));
  }

  if (normalizedActorRole !== 'admin') {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.UNAUTHORIZED_ACTOR,
      'Native intent change requires administrator authorization.',
    ));
  }

  if (!normalizedExpectedRevision) {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.MISSING_EXPECTED_REVISION,
      'Native intent change requires the current native authority revision.',
    ));
  }

  if (legacyPayload) {
    const detectedFields = detectLegacyFields(legacyPayload);
    if (detectedFields.length > 0) {
      const hasEstablishment = detectedFields.some(field =>
        ESTABLISHMENT_FIELD_NAMES.includes(field));
      risks.push(buildRisk(
        hasEstablishment
          ? POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.ESTABLISHMENT_FIELD_DETECTED
          : POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.LEGACY_FIELD_DETECTED,
        'Native intent change cannot accept browser-synthesized compatibility projections or establishment fields.',
        { detectedFields },
      ));
    }
  }

  const keyValidation = validateIdempotencyKey(idempotencyKey);
  if (idempotencyKey !== undefined && idempotencyKey !== null && keyValidation === false) {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.INVALID_IDEMPOTENCY_KEY,
      'Native intent change idempotency key must match the established format.',
    ));
  }

  const commandResult = validateChangeCommands(changeCommands);
  commandResult.unknown.forEach(commandId => {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.UNKNOWN_CHANGE_COMMAND,
      `Change command "${commandId}" is not in the allow-list.`,
    ));
  });
  commandResult.invalid.forEach(commandId => {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.INVALID_CHANGE_COMMAND,
      `Change command "${commandId}" does not satisfy its typed contract.`,
    ));
  });

  if (commandResult.validated.length === 0 && risks.length === 0) {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.EMPTY_CHANGE_COMMANDS,
      'Native intent change requires at least one allow-listed change command.',
    ));
  }

  if (authorityStatusId === 'no_active_native_intent' ||
      authorityStatusId === 'NO_ACTIVE_NATIVE_INTENT') {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.NO_ACTIVE_AUTHORITY,
      'No active native intent exists for this policy.',
    ));
  } else if (authorityStatusId === 'ambiguous_active_native_intents' ||
             authorityStatusId === 'AMBIGUOUS_ACTIVE_NATIVE_INTENTS') {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.AMBIGUOUS_AUTHORITY,
      'Native intent authority is ambiguous and cannot be safely changed.',
    ));
  } else if (authorityStatusId === 'single_non_authoritative_active_intent' ||
             authorityStatusId === 'SINGLE_NON_AUTHORITATIVE_ACTIVE_INTENT') {
    risks.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.NON_AUTHORITATIVE_AUTHORITY,
      'Native intent authority is non-authoritative and requires recovery.',
    ));
  }

  if (normalizedExpectedRevision && currentRevision !== null) {
    if (normalizedExpectedRevision !== currentRevision) {
      risks.push(buildRisk(
        POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.REVISION_MISMATCH,
        'Expected revision does not match the current native authority revision.',
        { expectedRevision: normalizedExpectedRevision, currentRevision },
      ));
    }
  }

  const statusId = determineStatusId(risks, commandResult.validated.length);

  const admission = {
    version: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_VERSION,
    statusId,
    admitted: statusId === POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.ADMITTED,
    policyId: normalizedPolicyId,
    actorId: normalizedActorId,
    expectedRevision: normalizedExpectedRevision,
    currentRevision,
    authorityStatusId: authorityStatusId || null,
    admittedCommands: statusId === POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.ADMITTED
      ? commandResult.validated
      : [],
    idempotencyKeyValid: keyValidation !== false,
    risks,
    riskCount: risks.length,
    retryable: statusId === POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE,
    recoveryRequired: RECOVERY_STATUS_IDS.includes(statusId),
    sideEffects: {
      policyStorageMutated: false,
      routingWritten: false,
      learningWritten: false,
      providerAccessed: false,
      databaseWritten: false,
    },
    nextStep: buildNextStep(statusId),
  };

  admission.validation = validatePolicyNativeIntentChangeAdmission(admission);

  return admission;
}

function determineStatusId(risks, validatedCommandCount) {
  const riskIds = new Set(risks.map(risk => risk.riskId));

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.UNAUTHORIZED_ACTOR) ||
      riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.MISSING_ACTOR_ID)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.AUTHORIZATION_REJECTED;
  }

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.MISSING_POLICY_ID)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE;
  }

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.NO_ACTIVE_AUTHORITY)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.UNAVAILABLE_AUTHORITY;
  }

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.AMBIGUOUS_AUTHORITY) ||
      riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.NON_AUTHORITATIVE_AUTHORITY)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RECOVERY_REQUIRED;
  }

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.REVISION_MISMATCH) ||
      riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.MISSING_EXPECTED_REVISION)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.STALE_REVISION;
  }

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.UNKNOWN_CHANGE_COMMAND)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.UNKNOWN_COMMAND;
  }

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.INVALID_CHANGE_COMMAND)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE;
  }

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.LEGACY_FIELD_DETECTED) ||
      riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.ESTABLISHMENT_FIELD_DETECTED) ||
      riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.INVALID_IDEMPOTENCY_KEY)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE;
  }

  if (riskIds.has(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.EMPTY_CHANGE_COMMANDS)) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE;
  }

  if (validatedCommandCount > 0 && risks.length === 0) {
    return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.ADMITTED;
  }

  return POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE;
}

function buildNextStep(statusId) {
  if (statusId === POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.ADMITTED) {
    return {
      stepId: 'persist_native_intent_change',
      label: 'Persist the admitted native intent change',
    };
  }

  if (statusId === POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.STALE_REVISION ||
      statusId === POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.POLICY_REPLACED) {
    return {
      stepId: 'reload_native_authority',
      label: 'Reload the current native authority projection',
    };
  }

  if (statusId === POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.AUTHORIZATION_REJECTED) {
    return {
      stepId: 'deny_request',
      label: 'Deny the unauthorized request',
    };
  }

  return {
    stepId: 'resolve_blocker',
    label: 'Resolve the change admission blocker',
  };
}

function validatePolicyNativeIntentChangeAdmission(admission) {
  const normalized = asObject(admission);
  const issues = [];

  if (normalizeString(normalized.version) !==
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_VERSION) {
    issues.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.VERSION_MISMATCH,
      'Native intent change admission must use the supported version.',
    ));
  }

  const risks = asArray(normalized.risks);
  const derivedStatusId = determineStatusId(risks, asArray(normalized.admittedCommands).length);

  if (derivedStatusId !== normalizeString(normalized.statusId)) {
    issues.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.DERIVED_STATUS_MISMATCH,
      'Admission status must match its risk-derived status.',
    ));
  }

  const expectedAdmitted = derivedStatusId ===
    POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.ADMITTED;

  if (normalized.admitted !== expectedAdmitted) {
    issues.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.ADMITTED_WITH_RISKS,
      'Admitted flag must agree with its risks and status.',
    ));
  }

  if (expectedAdmitted && risks.length > 0) {
    issues.push(buildRisk(
      POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.ADMITTED_WITH_RISKS,
      'An admitted change cannot carry risks.',
    ));
  }

  const sideEffects = asObject(normalized.sideEffects);
  Object.entries(sideEffects).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Native intent change admission cannot perform side effect "${key}".`,
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  ALLOWED_CHANGE_COMMAND_IDS,
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS,
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS,
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_VERSION,
  POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS,
  buildPolicyNativeIntentChangeAdmission,
  validatePolicyNativeIntentChangeAdmission,
};
