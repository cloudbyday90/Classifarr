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
  validatePolicyInitialDeclaredIntent,
} from './policyInitialIntentEstablishmentContract.mjs';

const POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_VERSION = 1;
const MAX_DECLARED_RULES = 128;

const POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS = Object.freeze({
  READY: 'initial_intent_establishment_ready',
  POLICY_NOT_FOUND: 'initial_intent_establishment_policy_not_found',
  LEGACY_CONFIGURATION_PRESENT: 'initial_intent_establishment_legacy_configuration_present',
  ACTIVE_NATIVE_INTENT: 'initial_intent_establishment_active_native_intent',
  NATIVE_INTENT_HISTORY_PRESENT: 'initial_intent_establishment_native_history_present',
  PENDING: 'initial_intent_establishment_pending',
  ESTABLISHED: 'initial_intent_establishment_recorded',
  REVERTED: 'initial_intent_establishment_reverted',
  RECOVERY_ATTENTION_REQUIRED: 'initial_intent_establishment_recovery_attention_required',
  READ_UNAVAILABLE: 'initial_intent_establishment_read_unavailable',
});

const POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS = Object.freeze({
  POLICY_NOT_FOUND: 'policy_not_found',
  LEGACY_CONFIGURATION_PRESENT: 'legacy_configuration_present',
  ACTIVE_NATIVE_INTENT: 'active_native_intent',
  NATIVE_INTENT_HISTORY_PRESENT: 'native_intent_history_present',
  INITIAL_ESTABLISHMENT_PENDING: 'initial_establishment_pending',
  INITIAL_ESTABLISHMENT_RECORDED: 'initial_establishment_recorded',
  DECLARED_RULE_SUMMARY_INVALID: 'declared_rule_summary_invalid',
  READ_UNAVAILABLE: 'read_unavailable',
});

const POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  NOT_READY: 'not_ready',
  ROLLBACK_AVAILABLE: 'rollback_available',
  REVERTED: 'reverted',
  ROLLBACK_EXPIRED: 'rollback_expired',
  ROLLBACK_PAYLOAD_REDACTED: 'rollback_payload_redacted',
  ROLLBACK_SNAPSHOT_MISSING: 'rollback_snapshot_missing',
  NATIVE_INTENT_INACTIVE: 'native_intent_inactive',
});

const POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS = Object.freeze({
  NOT_AVAILABLE: 'not_available',
  AVAILABLE: 'available',
  INVALID: 'invalid',
});

const INTENT_ROLE_BY_COLLECTION = Object.freeze({
  purpose: 'purpose',
  hard_limits: 'hard_limit',
  helpful_hints: 'helpful_hint',
  avoid: 'avoid',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeCount(value) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) return 0;
  return Math.min(numericValue, Number.MAX_SAFE_INTEGER);
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (typeof value !== 'string') return null;
    try {
      return parseObject(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return value;
}

function createEmptyDeclaredIntent() {
  return {
    purpose: [],
    hard_limits: [],
    helpful_hints: [],
    avoid: [],
  };
}

function buildDeclaredRuleSummary(rows = [], { establishmentRecorded = false } = {}) {
  if (!establishmentRecorded) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS.NOT_AVAILABLE,
      ruleCount: 0,
      declaredIntent: null,
    };
  }

  const safeRows = asArray(rows);
  if (safeRows.length > MAX_DECLARED_RULES) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS.INVALID,
      ruleCount: 0,
      declaredIntent: null,
    };
  }

  const declaredIntent = createEmptyDeclaredIntent();
  for (const row of safeRows) {
    const collection = typeof row?.collection === 'string' ? row.collection : null;
    if (
      !Object.hasOwn(declaredIntent, collection)
      || row.intent_role !== INTENT_ROLE_BY_COLLECTION[collection]
    ) {
      return {
        stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS.INVALID,
        ruleCount: 0,
        declaredIntent: null,
      };
    }

    const values = parseObject(row.values);
    if (!values) {
      return {
        stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS.INVALID,
        ruleCount: 0,
        declaredIntent: null,
      };
    }

    declaredIntent[collection].push({
      signal_type: row.signal_type,
      operator: row.operator,
      values,
      constraint_mode: row.constraint_mode ?? null,
      semantics: row.semantics ?? null,
    });
  }

  const validation = validatePolicyInitialDeclaredIntent(declaredIntent);
  if (!validation.ok) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS.INVALID,
      ruleCount: 0,
      declaredIntent: null,
    };
  }

  return {
    stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS.AVAILABLE,
    ruleCount: safeRows.length,
    declaredIntent: validation.declaredIntent,
  };
}

function buildRecovery({ record = {}, now = new Date() } = {}) {
  const establishmentState = record.establishment_state;
  const snapshotId = normalizePositiveInteger(record.rollback_snapshot_id);
  const expiresAt = normalizeTimestamp(record.rollback_expires_at);
  const restoredAt = normalizeTimestamp(record.rollback_restored_at);
  const currentTime = now instanceof Date ? now : new Date(now);

  if (!normalizePositiveInteger(record.establishment_id)) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.NOT_APPLICABLE,
      rollbackAvailable: false,
      snapshotId: null,
      expiresAt: null,
      restoredAt: null,
    };
  }

  if (establishmentState !== 'established') {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.NOT_READY,
      rollbackAvailable: false,
      snapshotId: null,
      expiresAt: null,
      restoredAt: null,
    };
  }

  if (!snapshotId) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.ROLLBACK_SNAPSHOT_MISSING,
      rollbackAvailable: false,
      snapshotId: null,
      expiresAt: null,
      restoredAt: null,
    };
  }

  if (restoredAt) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.REVERTED,
      rollbackAvailable: false,
      snapshotId,
      expiresAt,
      restoredAt,
    };
  }

  if (record.rollback_payload_redacted === true) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.ROLLBACK_PAYLOAD_REDACTED,
      rollbackAvailable: false,
      snapshotId,
      expiresAt,
      restoredAt: null,
    };
  }

  if (!expiresAt || new Date(expiresAt).getTime() <= currentTime.getTime()) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.ROLLBACK_EXPIRED,
      rollbackAvailable: false,
      snapshotId,
      expiresAt,
      restoredAt: null,
    };
  }

  if (record.established_intent_active !== true) {
    return {
      stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.NATIVE_INTENT_INACTIVE,
      rollbackAvailable: false,
      snapshotId,
      expiresAt,
      restoredAt: null,
    };
  }

  return {
    stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.ROLLBACK_AVAILABLE,
    rollbackAvailable: true,
    snapshotId,
    expiresAt,
    restoredAt: null,
  };
}

function buildEstablishmentHistory(record = {}, recovery) {
  const establishmentId = normalizePositiveInteger(record.establishment_id);
  if (!establishmentId) {
    return {
      stateId: 'not_recorded',
      idempotencyStateId: 'not_recorded',
      establishment: null,
      recovery,
    };
  }

  return {
    stateId: record.establishment_state === 'established'
      ? (recovery.stateId === POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.REVERTED
        ? 'reverted'
        : 'established')
      : 'pending',
    idempotencyStateId: record.establishment_state === 'established' ? 'recorded' : 'pending',
    establishment: {
      id: establishmentId,
      intentId: normalizePositiveInteger(record.established_intent_id),
      establishedAt: normalizeTimestamp(record.established_at),
      authoritySourceId: 'operator_declared_intent',
    },
    recovery,
  };
}

function addIssue(issues, riskId, message) {
  issues.push({ riskId, message });
}

function buildPolicyInitialIntentEstablishmentReadiness({
  record = null,
  rules = [],
  now = new Date(),
} = {}) {
  if (!record) {
    return {
      version: POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_VERSION,
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.POLICY_NOT_FOUND,
      policyId: null,
      eligibility: {
        canEstablishInitialIntent: false,
        blockers: [{
          riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS.POLICY_NOT_FOUND,
          message: 'The policy is no longer available for initial intent establishment.',
        }],
      },
      legacyConfiguration: { presetAttachmentCount: 0, overrideCount: 0 },
      nativeIntentHistory: { count: 0, activeCount: 0 },
      establishmentHistory: buildEstablishmentHistory({}, buildRecovery({ now })),
      declaredRuleSummary: buildDeclaredRuleSummary([], { establishmentRecorded: false }),
      sideEffects: { readOnly: true, automationStarted: false },
    };
  }

  const policyId = normalizePositiveInteger(record.policy_id);
  const legacyConfiguration = {
    presetAttachmentCount: normalizeCount(record.preset_attachment_count),
    overrideCount: normalizeCount(record.override_count),
  };
  const nativeIntentHistory = {
    count: normalizeCount(record.native_intent_count),
    activeCount: normalizeCount(record.active_native_intent_count),
  };
  const recovery = buildRecovery({ record, now });
  const establishmentHistory = buildEstablishmentHistory(record, recovery);
  const establishmentRecorded = establishmentHistory.stateId !== 'not_recorded';
  const declaredRuleSummary = buildDeclaredRuleSummary(rules, {
    establishmentRecorded: record.establishment_state === 'established',
  });
  const blockers = [];
  const hasLegacyConfiguration = legacyConfiguration.presetAttachmentCount > 0
    || legacyConfiguration.overrideCount > 0;

  if (establishmentHistory.stateId === 'pending') {
    addIssue(
      blockers,
      POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS.INITIAL_ESTABLISHMENT_PENDING,
      'An initial establishment is pending and must finish or be rolled back before it can be evaluated again.'
    );
  } else if (establishmentRecorded) {
    addIssue(
      blockers,
      POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS.INITIAL_ESTABLISHMENT_RECORDED,
      'This policy already has a recorded initial native intent establishment and cannot establish a second first authority.'
    );
  } else {
    if (hasLegacyConfiguration) {
      addIssue(
        blockers,
        POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS.LEGACY_CONFIGURATION_PRESENT,
        'Legacy preset attachments or policy overrides are present and must follow the configured-policy path.'
      );
    }
    if (nativeIntentHistory.activeCount > 0) {
      addIssue(
        blockers,
        POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS.ACTIVE_NATIVE_INTENT,
        'An active native intent already controls this policy.'
      );
    } else if (nativeIntentHistory.count > 0) {
      addIssue(
        blockers,
        POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS.NATIVE_INTENT_HISTORY_PRESENT,
        'Native intent history exists for this policy, so first establishment cannot overwrite it.'
      );
    }
  }

  if (declaredRuleSummary.stateId === POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS.INVALID) {
    addIssue(
      blockers,
      POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS.DECLARED_RULE_SUMMARY_INVALID,
      'The recorded initial declared rules are incomplete or invalid and require maintenance review.'
    );
  }

  let statusId = POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.READY;
  if (establishmentHistory.stateId === 'pending') {
    statusId = POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.PENDING;
  } else if (establishmentRecorded) {
    if (recovery.stateId === POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.REVERTED) {
      statusId = POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.REVERTED;
    } else if (
      recovery.stateId !== POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.ROLLBACK_AVAILABLE
      || declaredRuleSummary.stateId === POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS.INVALID
    ) {
      statusId = POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.RECOVERY_ATTENTION_REQUIRED;
    } else {
      statusId = POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.ESTABLISHED;
    }
  } else if (nativeIntentHistory.activeCount > 0) {
    statusId = POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.ACTIVE_NATIVE_INTENT;
  } else if (nativeIntentHistory.count > 0) {
    statusId = POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.NATIVE_INTENT_HISTORY_PRESENT;
  } else if (hasLegacyConfiguration) {
    statusId = POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.LEGACY_CONFIGURATION_PRESENT;
  }

  return {
    version: POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_VERSION,
    statusId,
    policyId,
    eligibility: {
      canEstablishInitialIntent: blockers.length === 0,
      blockers,
    },
    legacyConfiguration,
    nativeIntentHistory,
    establishmentHistory,
    declaredRuleSummary,
    sideEffects: {
      readOnly: true,
      automationStarted: false,
    },
  };
}

function buildReadUnavailableResult(policyId = null) {
  return {
    version: POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_VERSION,
    statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.READ_UNAVAILABLE,
    policyId: normalizePositiveInteger(policyId),
    eligibility: {
      canEstablishInitialIntent: false,
      blockers: [{
        riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS.READ_UNAVAILABLE,
        message: 'Initial establishment readiness is temporarily unavailable. Retry without making changes.',
      }],
    },
    legacyConfiguration: { presetAttachmentCount: 0, overrideCount: 0 },
    nativeIntentHistory: { count: 0, activeCount: 0 },
    establishmentHistory: buildEstablishmentHistory({}, buildRecovery()),
    declaredRuleSummary: buildDeclaredRuleSummary([], { establishmentRecorded: false }),
    sideEffects: { readOnly: true, automationStarted: false },
  };
}

export {
  POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_RISK_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_VERSION,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RULE_SUMMARY_STATE_IDS,
  buildPolicyInitialIntentEstablishmentReadiness,
  buildReadUnavailableResult,
  normalizePositiveInteger,
};
