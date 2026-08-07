/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_VERSION =
  'policy.persisted_policy_maintenance_entry.v1';

const POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS = Object.freeze({
  INSPECT_ONLY: 'inspect_only',
  NATIVE_CHANGE_ELIGIBLE: 'native_change_eligible',
  RECOVERY_REQUIRED: 'recovery_required',
  COMPATIBILITY_MAINTENANCE_ONLY: 'compatibility_maintenance_only',
  CREATE_PATH: 'create_path',
});

const POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS = Object.freeze({
  VERSION_MISMATCH: 'version_mismatch',
  UNKNOWN_DISPOSITION: 'unknown_disposition',
  NATIVE_CHANGE_WITHOUT_AUTHORITY: 'native_change_without_authority',
  NATIVE_CHANGE_WITHOUT_READINESS: 'native_change_without_readiness',
  RECOVERY_WITH_INSPECT: 'recovery_with_inspect',
  COMPATIBILITY_WITH_NATIVE_DISPOSITION: 'compatibility_with_native_disposition',
  CREATE_PATH_WITH_EXISTING_POLICY: 'create_path_with_existing_policy',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  DISPOSITION_DERIVED_MISMATCH: 'disposition_derived_mismatch',
});

const POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS = Object.freeze([
  'update_purpose',
  'update_hard_limits',
  'update_avoid_rules',
  'update_helpful_matches',
  'update_routing_target',
  'update_review_triggers',
]);

const NATIVE_AUTHORITATIVE_STATES = Object.freeze([
  'single_active_native_intent',
  'SINGLE_ACTIVE_NATIVE_INTENT',
]);

const RECOVERY_STATES = Object.freeze([
  'ambiguous_active_native_intents',
  'AMBIGUOUS_ACTIVE_NATIVE_INTENTS',
  'single_non_authoritative_active_intent',
  'SINGLE_NON_AUTHORITATIVE_ACTIVE_INTENT',
  'no_active_native_intent',
  'NO_ACTIVE_NATIVE_INTENT',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value) {
  return value === true;
}

function buildNextAdmittedAction() {
  return {
    actionId: 'enter_native_maintenance',
    changeAdmissionVersion: 'policy.native_intent_change_admission.v1',
    allowedChangeCommands: [...POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS],
    requiresRevisionCheck: true,
    requiresAdministrator: true,
  };
}

function determineDisposition({
  policySource,
  authorityStateId,
  readinessStateId,
  hasActivePolicy,
}) {
  const source = normalizeString(policySource);
  const authority = normalizeString(authorityStateId);
  const readiness = normalizeString(readinessStateId);

  if (!hasActivePolicy && source !== 'compatibility') {
    return POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.CREATE_PATH;
  }

  if (source === 'compatibility' || source === 'legacy_presets') {
    return POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.COMPATIBILITY_MAINTENANCE_ONLY;
  }

  if (RECOVERY_STATES.includes(authority)) {
    return POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.RECOVERY_REQUIRED;
  }

  if (!NATIVE_AUTHORITATIVE_STATES.includes(authority)) {
    return POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.RECOVERY_REQUIRED;
  }

  if (readiness === 'stale_profile') {
    return POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.RECOVERY_REQUIRED;
  }

  if (readiness === 'blocked_by_hard_limit' || readiness === 'needs_operator_review') {
    return POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.INSPECT_ONLY;
  }

  return POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.NATIVE_CHANGE_ELIGIBLE;
}

function buildPolicyPersistedPolicyMaintenanceEntry({
  policySource = 'native_intent',
  authorityState = {},
  readinessState = {},
  hasActivePolicy = true,
} = {}) {
  const authority = asObject(authorityState);
  const readiness = asObject(readinessState);

  const authorityStateId = normalizeString(authority.stateId ?? authority.statusId);
  const readinessStateId = normalizeString(readiness.stateId ?? readiness.statusId);
  const source = normalizeString(policySource);

  const dispositionId = determineDisposition({
    policySource: source,
    authorityStateId,
    readinessStateId,
    hasActivePolicy: normalizeBoolean(hasActivePolicy),
  });

  const isNativeChangeEligible = dispositionId ===
    POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.NATIVE_CHANGE_ELIGIBLE;

  const entry = {
    version: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_VERSION,
    dispositionId,
    policySource: source || 'native_intent',
    authorityStateId: authorityStateId || null,
    readinessStateId: readinessStateId || null,
    nextAdmittedAction: isNativeChangeEligible ? buildNextAdmittedAction() : null,
    maintenanceAvailable: isNativeChangeEligible,
    compatibilityMaintenanceIsolated: dispositionId ===
      POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.COMPATIBILITY_MAINTENANCE_ONLY,
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
    },
    sideEffects: {
      policyStorageMutated: false,
      routingWritten: false,
      learningWritten: false,
      providerAccessed: false,
      databaseWritten: false,
    },
  };

  entry.validation = validatePolicyPersistedPolicyMaintenanceEntry(entry);

  return entry;
}

function validatePolicyPersistedPolicyMaintenanceEntry(entry) {
  const normalized = asObject(entry);
  const issues = [];

  if (normalizeString(normalized.version) !==
      POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_VERSION) {
    issues.push({
      riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.VERSION_MISMATCH,
      message: 'Persisted policy maintenance entry must use the supported version.',
    });
  }

  const dispositionId = normalizeString(normalized.dispositionId);
  const validDispositions = Object.values(POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS);

  if (!validDispositions.includes(dispositionId)) {
    issues.push({
      riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.UNKNOWN_DISPOSITION,
      message: `Unknown maintenance disposition "${dispositionId}".`,
    });
  }

  if (dispositionId === POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.NATIVE_CHANGE_ELIGIBLE &&
      !normalized.nextAdmittedAction) {
    issues.push({
      riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.NATIVE_CHANGE_WITHOUT_AUTHORITY,
      message: 'Native change eligible disposition must expose the next admitted action.',
    });
  }

  if (dispositionId === POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.COMPATIBILITY_MAINTENANCE_ONLY &&
      normalized.nextAdmittedAction) {
    issues.push({
      riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.COMPATIBILITY_WITH_NATIVE_DISPOSITION,
      message: 'Compatibility maintenance disposition must not expose a native change action.',
    });
  }

  const sideEffects = asObject(normalized.sideEffects);
  Object.entries(sideEffects).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Maintenance entry cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS,
  POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS,
  POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS,
  POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_VERSION,
  buildPolicyPersistedPolicyMaintenanceEntry,
  validatePolicyPersistedPolicyMaintenanceEntry,
};
