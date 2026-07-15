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
  POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS,
  buildPolicyIntentMigrationCandidateReport,
} from './policyIntentMigrationCandidateReport.mjs';
import {
  POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS,
  applyPolicyPostUpgradeApplyGate,
} from './policyPostUpgradeApplyGate.mjs';
import {
  buildPolicyPostUpgradeDryRun,
  loadPolicyPostUpgradeCandidateInputs,
} from './policyPostUpgradeDryRun.mjs';
import { POLICY_CONVERSION_ACTOR_SOURCE_IDS } from './policyConversionActorSources.mjs';
import {
  buildPolicyNativeIntentRuntimeObservation,
} from './policyNativeIntentRuntimeObservation.mjs';

const POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_VERSION =
  'policy.native_intent_conversion_operator_action.v1';
const POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION = 'CONVERT_NATIVE_INTENT';
const MAX_SELECTED_POLICY_COUNT = 25;

const POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS = Object.freeze({
  PREVIEW_READY: 'preview_ready',
  APPLIED: 'applied',
  ALREADY_CURRENT: 'already_current',
  BLOCKED_BY_REQUEST: 'blocked_by_request',
  BLOCKED_BY_SELECTION: 'blocked_by_selection',
  BLOCKED_BY_DRY_RUN: 'blocked_by_dry_run',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

const POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS = Object.freeze({
  ACTOR_REQUIRED: 'actor_required',
  CONFIRMATION_REQUIRED: 'confirmation_required',
  INVALID_SELECTION: 'invalid_selection',
  DUPLICATE_SELECTION: 'duplicate_selection',
  SELECTION_LIMIT_EXCEEDED: 'selection_limit_exceeded',
  POLICY_NOT_IN_CURRENT_REPORT: 'policy_not_in_current_report',
  POLICY_NOT_READY: 'policy_not_ready',
  DRY_RUN_INVALID: 'dry_run_invalid',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function buildNoSideEffects() {
  return {
    policyStorageMutated: false,
    nativeRowsInserted: false,
    migrationEventsWritten: false,
    rollbackSnapshotsWritten: false,
    legacyPathsDeleted: false,
  };
}

function normalizeSelection(policyIds) {
  if (!Array.isArray(policyIds)) {
    return {
      policyIds: [],
      riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.INVALID_SELECTION,
    };
  }

  const normalizedPolicyIds = policyIds.map(normalizePositiveInteger);
  if (normalizedPolicyIds.some(policyId => !policyId) || normalizedPolicyIds.length === 0) {
    return {
      policyIds: [],
      riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.INVALID_SELECTION,
    };
  }

  if (normalizedPolicyIds.length > MAX_SELECTED_POLICY_COUNT) {
    return {
      policyIds: [],
      riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.SELECTION_LIMIT_EXCEEDED,
    };
  }

  if (new Set(normalizedPolicyIds).size !== normalizedPolicyIds.length) {
    return {
      policyIds: [],
      riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.DUPLICATE_SELECTION,
    };
  }

  return { policyIds: normalizedPolicyIds, riskId: null };
}

function validateOperatorAction({ actorId, policyIds, confirmation } = {}) {
  const normalizedActorId = normalizePositiveInteger(actorId);
  const selection = normalizeSelection(policyIds);
  const issues = [];

  if (!normalizedActorId) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.ACTOR_REQUIRED,
      message: 'A verified administrator identity is required for native intent conversion.',
    });
  }

  if (confirmation !== POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION) {
    issues.push({
      riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.CONFIRMATION_REQUIRED,
      message: 'Native intent conversion requires the exact operator confirmation.',
    });
  }

  if (selection.riskId) {
    issues.push({
      riskId: selection.riskId,
      message: selection.riskId === POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.SELECTION_LIMIT_EXCEEDED
        ? `Select no more than ${MAX_SELECTED_POLICY_COUNT} policies per conversion action.`
        : 'Select one or more unique, positive policy identifiers for conversion.',
    });
  }

  return {
    ok: issues.length === 0,
    actorId: normalizedActorId,
    policyIds: selection.policyIds,
    issues,
  };
}

function buildCandidateReport({ policies, activeIntentIntegrityReport, maxPolicies }) {
  return buildPolicyIntentMigrationCandidateReport({
    policies,
    activeIntentIntegrityReport,
    maxPolicies,
  });
}

function buildSelectionState({ candidateReport, policyIds }) {
  const candidatesByPolicyId = new Map(
    asArray(candidateReport?.candidates).map(candidate => [Number(candidate.policyId), candidate])
  );
  const unknownPolicyIds = policyIds.filter(policyId => !candidatesByPolicyId.has(policyId));
  const nonReadySelections = policyIds
    .map(policyId => candidatesByPolicyId.get(policyId))
    .filter(candidate => candidate && candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT)
    .map(candidate => ({
      policyId: Number(candidate.policyId),
      statusId: candidate.statusId,
    }));

  return {
    requestedPolicyIds: policyIds,
    requestedPolicyCount: policyIds.length,
    unknownPolicyIds,
    nonReadySelections,
    readyPolicyIds: policyIds.filter(policyId => {
      const candidate = candidatesByPolicyId.get(policyId);
      return candidate?.statusId === POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT;
    }),
  };
}

function buildActionResult({
  mode,
  statusId,
  evaluatedAt,
  selection = null,
  candidateReport = null,
  dryRun = null,
  applyGate = null,
  runtimeObservation = null,
  issues = [],
} = {}) {
  const applied = applyGate?.applied === true;
  const alreadyConvertedCount = applyGate?.alreadyConvertedCount ?? 0;

  return {
    version: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_VERSION,
    mode,
    statusId,
    evaluatedAt,
    selection,
    ...(candidateReport ? { candidateReport } : {}),
    ...(dryRun ? { dryRun } : {}),
    ...(applyGate ? { applyGate } : {}),
    ...(runtimeObservation ? { runtimeObservation } : {}),
    confirmation: {
      requiredValue: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION,
      accepted: applied,
    },
    summary: {
      requestedPolicyCount: selection?.requestedPolicyCount ?? 0,
      readyPolicyCount: selection?.readyPolicyIds?.length ?? 0,
      appliedPolicyCount: applyGate?.appliedPolicyCount ?? 0,
      alreadyConvertedCount,
    },
    sideEffects: applied
      ? applyGate.sideEffects
      : buildNoSideEffects(),
    validation: {
      ok: issues.length === 0,
      issueCount: issues.length,
      issues,
    },
  };
}

async function previewPolicyNativeIntentConversion({
  dbClient,
  maxPolicies,
  now = null,
} = {}) {
  const evaluatedAt = normalizeTimestamp(now);
  const { policies, activeIntentIntegrityReport } = await loadPolicyPostUpgradeCandidateInputs({
    dbClient,
    maxPolicies,
  });
  const candidateReport = buildCandidateReport({
    policies,
    activeIntentIntegrityReport,
    maxPolicies,
  });

  return buildActionResult({
    mode: 'preview',
    statusId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.PREVIEW_READY,
    evaluatedAt,
    candidateReport,
  });
}

async function applyPolicyNativeIntentConversion({
  dbClient,
  action,
  maxPolicies,
  now = null,
} = {}) {
  const evaluatedAt = normalizeTimestamp(now);
  const actionValidation = validateOperatorAction(action);

  if (!actionValidation.ok) {
    return buildActionResult({
      mode: 'apply',
      statusId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_REQUEST,
      evaluatedAt,
      issues: actionValidation.issues,
    });
  }

  const { policies, activeIntentIntegrityReport } = await loadPolicyPostUpgradeCandidateInputs({
    dbClient,
    maxPolicies,
  });
  const candidateReport = buildCandidateReport({
    policies,
    activeIntentIntegrityReport,
    maxPolicies,
  });
  const selection = buildSelectionState({
    candidateReport,
    policyIds: actionValidation.policyIds,
  });
  const selectionIssues = [
    ...(selection.unknownPolicyIds.length > 0 ? [{
      riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.POLICY_NOT_IN_CURRENT_REPORT,
      message: 'Each selected policy must exist in the current bounded conversion report.',
    }] : []),
    ...(selection.nonReadySelections.length > 0 ? [{
      riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.POLICY_NOT_READY,
      message: 'Every selected policy must be ready to convert at apply time.',
    }] : []),
  ];

  if (selectionIssues.length > 0) {
    return buildActionResult({
      mode: 'apply',
      statusId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_SELECTION,
      evaluatedAt,
      selection,
      candidateReport,
      issues: selectionIssues,
    });
  }

  const dryRun = buildPolicyPostUpgradeDryRun({
    policies,
    candidateReport,
    activeIntentIntegrityReport,
    selectedPolicyIds: actionValidation.policyIds,
    action: {
      actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
      actorId: actionValidation.actorId,
      reasonCode: 'operator_native_intent_conversion',
      requestedAt: evaluatedAt,
    },
    maxPolicies,
    now: evaluatedAt,
  });

  if (dryRun.validation?.ok !== true) {
    return buildActionResult({
      mode: 'apply',
      statusId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_DRY_RUN,
      evaluatedAt,
      selection,
      candidateReport,
      dryRun,
      issues: [{
        riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.DRY_RUN_INVALID,
        message: 'The current conversion plan did not pass server validation.',
      }],
    });
  }

  const applyGate = await applyPolicyPostUpgradeApplyGate({
    dbClient,
    dryRun,
    policies,
    now: evaluatedAt,
    actorId: actionValidation.actorId,
  });
  const statusId = applyGate.statusId === POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.APPLIED
    ? (applyGate.appliedPolicyCount === 0
      ? POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.ALREADY_CURRENT
      : POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.APPLIED)
    : applyGate.statusId === POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.FAILED_ROLLED_BACK
      ? POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.FAILED_ROLLED_BACK
      : POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_DRY_RUN;
  const runtimeObservation = [
    POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.APPLIED,
    POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.ALREADY_CURRENT,
  ].includes(statusId)
    ? await buildPolicyNativeIntentRuntimeObservation({
      dbClient,
      policyIds: actionValidation.policyIds,
      now: evaluatedAt,
    })
    : null;

  return buildActionResult({
    mode: 'apply',
    statusId,
    evaluatedAt,
    selection,
    candidateReport,
    dryRun,
    applyGate,
    runtimeObservation,
    issues: statusId === POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_DRY_RUN
      ? [{
        riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.DRY_RUN_INVALID,
        message: 'The conversion apply gate rejected the current server-evaluated plan.',
      }]
      : [],
  });
}

export {
  MAX_SELECTED_POLICY_COUNT,
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS,
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS,
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_VERSION,
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION,
  applyPolicyNativeIntentConversion,
  previewPolicyNativeIntentConversion,
  validateOperatorAction,
};
