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
  POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS,
  listPolicyPreviewReplayVerifierArtifacts,
} from './policyPreviewReplayVerifierCutline.mjs';

const POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_VERSION =
  'policy.preview_replay_verifier_deletion_gate.v1';

const POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS = Object.freeze({
  READY_FOR_VERIFIER_DELETION: 'ready_for_verifier_deletion',
  BLOCKED_BY_MIGRATION_PARITY: 'blocked_by_migration_parity',
  BLOCKED_BY_NATIVE_STORAGE_CUTOVER: 'blocked_by_native_storage_cutover',
  BLOCKED_BY_ROLLBACK_RETENTION: 'blocked_by_rollback_retention',
  BLOCKED_BY_ACTIVE_REBUILD_BINDING: 'blocked_by_active_rebuild_binding',
  BLOCKED_BY_PROMOTION_REPLACEMENT: 'blocked_by_promotion_replacement',
  BLOCKED_BY_CUTLINE_INVENTORY: 'blocked_by_cutline_inventory',
});

const POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS = Object.freeze({
  MIGRATION_PARITY_NOT_PROVEN: 'migration_parity_not_proven',
  MIGRATION_PARITY_EVIDENCE_MISSING: 'migration_parity_evidence_missing',
  NATIVE_STORAGE_CUTOVER_NOT_COMPLETE: 'native_storage_cutover_not_complete',
  NATIVE_STORAGE_CUTOVER_EVIDENCE_MISSING: 'native_storage_cutover_evidence_missing',
  ROLLBACK_RETENTION_NOT_EXPIRED: 'rollback_retention_not_expired',
  ROLLBACK_RETENTION_EVIDENCE_MISSING: 'rollback_retention_evidence_missing',
  ACTIVE_REBUILD_BINDING_REMAINS: 'active_rebuild_binding_remains',
  REBUILD_BINDING_EVIDENCE_MISSING: 'rebuild_binding_evidence_missing',
  PROMOTION_REPLACEMENT_NOT_ACCEPTED: 'promotion_replacement_not_accepted',
  PROMOTION_REPLACEMENT_EVIDENCE_MISSING: 'promotion_replacement_evidence_missing',
  CUTLINE_INVENTORY_DRIFT: 'cutline_inventory_drift',
  CUTLINE_INVENTORY_EMPTY: 'cutline_inventory_empty',
  UNSAFE_DELETION_EXECUTION: 'unsafe_deletion_execution',
  VERSION_MISMATCH: 'version_mismatch',
  DERIVED_STATUS_MISMATCH: 'derived_status_mismatch',
  READY_STATUS_INVALID: 'ready_status_invalid',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const REQUIRED_EXIT_CRITERION_IDS = Object.freeze([
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.NATIVE_MIGRATION_PARITY_PROVEN,
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.NATIVE_STORAGE_CUTOVER_COMPLETE,
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.ROLLBACK_RETENTION_WINDOW_EXPIRED,
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.NO_ACTIVE_REBUILD_BINDING,
]);

const REQUIRED_DELETION_POLICY = Object.freeze({
  executeDeletionNow: false,
  requireSeparateExecutionStep: true,
  allowPromotionWithoutReplacement: false,
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function buildRisk(riskId, message, metadata = null) {
  return {
    riskId,
    message,
    ...(metadata ? { metadata } : {}),
  };
}

function evaluateMigrationParity(evidence) {
  const normalized = asObject(evidence);

  if (!normalizeBoolean(normalized.proven)) {
    return {
      summary: { proven: false },
      risk: buildRisk(
        normalized.proven === undefined
          ? POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.MIGRATION_PARITY_EVIDENCE_MISSING
          : POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.MIGRATION_PARITY_NOT_PROVEN,
        'Migration parity must be explicitly proven before verifier artifacts can be deleted or promoted.',
      ),
    };
  }

  return { summary: { proven: true }, risk: null };
}

function evaluateNativeStorageCutover(evidence) {
  const normalized = asObject(evidence);

  if (!normalizeBoolean(normalized.complete)) {
    return {
      summary: { complete: false },
      risk: buildRisk(
        normalized.complete === undefined
          ? POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.NATIVE_STORAGE_CUTOVER_EVIDENCE_MISSING
          : POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.NATIVE_STORAGE_CUTOVER_NOT_COMPLETE,
        'Native storage cutover must be complete before verifier artifacts can be deleted or promoted.',
      ),
    };
  }

  const unconvertedCount = normalizeNonNegativeInteger(normalized.unconvertedPolicyCount);
  return {
    summary: { complete: true, unconvertedPolicyCount: unconvertedCount ?? 0 },
    risk: null,
  };
}

function evaluateRollbackRetention(evidence) {
  const normalized = asObject(evidence);

  if (!normalizeBoolean(normalized.expired)) {
    return {
      summary: { expired: false },
      risk: buildRisk(
        normalized.expired === undefined
          ? POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.ROLLBACK_RETENTION_EVIDENCE_MISSING
          : POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.ROLLBACK_RETENTION_NOT_EXPIRED,
        'Rollback retention window must be expired before verifier artifacts can be deleted or promoted.',
      ),
    };
  }

  return {
    summary: { expired: true },
    risk: null,
  };
}

function evaluateRebuildBinding(evidence) {
  const normalized = asObject(evidence);

  if (!normalizeBoolean(normalized.noActiveBinding)) {
    return {
      summary: { noActiveBinding: false },
      risk: buildRisk(
        normalized.noActiveBinding === undefined
          ? POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.REBUILD_BINDING_EVIDENCE_MISSING
          : POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.ACTIVE_REBUILD_BINDING_REMAINS,
        'No active rebuild binding must be confirmed before verifier artifacts can be deleted or promoted.',
      ),
    };
  }

  return {
    summary: { noActiveBinding: true },
    risk: null,
  };
}

function evaluatePromotionReplacement(artifacts, evidence) {
  const normalized = asObject(evidence);
  const replacementAccepted = normalizeBoolean(normalized.accepted);
  const promotionArtifacts = artifacts.filter(artifact =>
    asArray(artifact.exitCriterionIds).includes(
      POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.RUNTIME_EVIDENCE_REPLACEMENT_ACCEPTED,
    ),
  );

  if (promotionArtifacts.length === 0) {
    return { summary: { required: false, accepted: true }, risk: null };
  }

  if (!replacementAccepted) {
    return {
      summary: { required: true, accepted: false, artifactCount: promotionArtifacts.length },
      risk: buildRisk(
        POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.PROMOTION_REPLACEMENT_NOT_ACCEPTED,
        'Artifacts with a runtime-evidence replacement exit criterion require an accepted replacement contract before deletion or promotion.',
      ),
    };
  }

  return {
    summary: { required: true, accepted: true, artifactCount: promotionArtifacts.length },
    risk: null,
  };
}

function evaluateCutlineInventory(artifacts) {
  const activeArtifacts = artifacts.filter(artifact =>
    artifact.dispositionId !==
      POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE);

  if (activeArtifacts.length === 0) {
    return {
      summary: { activeArtifactCount: 0 },
      risk: buildRisk(
        POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.CUTLINE_INVENTORY_EMPTY,
        'The verifier cutline must contain at least one active artifact for evaluation.',
      ),
    };
  }

  const missingExitCriteria = activeArtifacts.filter(artifact =>
    asArray(artifact.exitCriterionIds).length === 0);

  if (missingExitCriteria.length > 0) {
    return {
      summary: {
        activeArtifactCount: activeArtifacts.length,
        missingExitCriteriaCount: missingExitCriteria.length,
      },
      risk: buildRisk(
        POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.CUTLINE_INVENTORY_DRIFT,
        'Every active verifier artifact must define its exit criteria.',
      ),
    };
  }

  return {
    summary: { activeArtifactCount: activeArtifacts.length, missingExitCriteriaCount: 0 },
    risk: null,
  };
}

function determineStatusId(risks) {
  const riskIds = new Set(risks.map(risk => risk.riskId));

  if (riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.MIGRATION_PARITY_EVIDENCE_MISSING) ||
      riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.MIGRATION_PARITY_NOT_PROVEN)) {
    return POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_MIGRATION_PARITY;
  }

  if (riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.NATIVE_STORAGE_CUTOVER_EVIDENCE_MISSING) ||
      riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.NATIVE_STORAGE_CUTOVER_NOT_COMPLETE)) {
    return POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_NATIVE_STORAGE_CUTOVER;
  }

  if (riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.ROLLBACK_RETENTION_EVIDENCE_MISSING) ||
      riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.ROLLBACK_RETENTION_NOT_EXPIRED)) {
    return POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_ROLLBACK_RETENTION;
  }

  if (riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.REBUILD_BINDING_EVIDENCE_MISSING) ||
      riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.ACTIVE_REBUILD_BINDING_REMAINS)) {
    return POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_ACTIVE_REBUILD_BINDING;
  }

  if (riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.PROMOTION_REPLACEMENT_EVIDENCE_MISSING) ||
      riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.PROMOTION_REPLACEMENT_NOT_ACCEPTED)) {
    return POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_PROMOTION_REPLACEMENT;
  }

  if (riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.CUTLINE_INVENTORY_DRIFT) ||
      riskIds.has(POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.CUTLINE_INVENTORY_EMPTY)) {
    return POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_CUTLINE_INVENTORY;
  }

  return POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.READY_FOR_VERIFIER_DELETION;
}

function buildPolicyPreviewReplayVerifierDeletionGate({
  artifacts = listPolicyPreviewReplayVerifierArtifacts(),
  migrationParityEvidence,
  nativeStorageCutoverEvidence,
  rollbackRetentionEvidence,
  rebuildBindingEvidence,
  promotionReplacementEvidence,
} = {}) {
  const normalizedArtifacts = asArray(artifacts);
  const risks = [];

  const inventoryResult = evaluateCutlineInventory(normalizedArtifacts);
  if (inventoryResult.risk) risks.push(inventoryResult.risk);

  const parityResult = evaluateMigrationParity(migrationParityEvidence);
  if (parityResult.risk) risks.push(parityResult.risk);

  const cutoverResult = evaluateNativeStorageCutover(nativeStorageCutoverEvidence);
  if (cutoverResult.risk) risks.push(cutoverResult.risk);

  const rollbackResult = evaluateRollbackRetention(rollbackRetentionEvidence);
  if (rollbackResult.risk) risks.push(rollbackResult.risk);

  const bindingResult = evaluateRebuildBinding(rebuildBindingEvidence);
  if (bindingResult.risk) risks.push(bindingResult.risk);

  const promotionResult = evaluatePromotionReplacement(normalizedArtifacts, promotionReplacementEvidence);
  if (promotionResult.risk) risks.push(promotionResult.risk);

  const statusId = determineStatusId(risks);
  const readyForDeletion = risks.length === 0 &&
    statusId === POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.READY_FOR_VERIFIER_DELETION;

  const activeArtifacts = normalizedArtifacts.filter(artifact =>
    artifact.dispositionId !==
      POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE);
  const retiredArtifacts = normalizedArtifacts.filter(artifact =>
    artifact.dispositionId ===
      POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE);

  const gate = {
    version: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_VERSION,
    statusId,
    readyForDeletion,
    requiredExitCriterionIds: REQUIRED_EXIT_CRITERION_IDS,
    conditions: {
      migrationParity: parityResult.summary,
      nativeStorageCutover: cutoverResult.summary,
      rollbackRetention: rollbackResult.summary,
      rebuildBinding: bindingResult.summary,
      promotionReplacement: promotionResult.summary,
    },
    inventory: inventoryResult.summary,
    artifacts: {
      activeCount: activeArtifacts.length,
      retiredCount: retiredArtifacts.length,
      activePaths: activeArtifacts.map(artifact => artifact.path),
    },
    riskCount: risks.length,
    risks,
    deletionPolicy: REQUIRED_DELETION_POLICY,
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      deletionManifestWritten: false,
    },
    nextStep: readyForDeletion
      ? {
        stepId: 'execute_verifier_deletion_or_promotion',
        label: 'Execute verifier deletion or promotion',
        reason: 'All exit criteria are proven. A separate execution step may proceed.',
      }
      : {
        stepId: 'resolve_verifier_deletion_blockers',
        label: 'Resolve verifier deletion blockers',
        reason: 'One or more exit criteria are not yet proven.',
      },
  };

  gate.validation = validatePolicyPreviewReplayVerifierDeletionGate(gate);

  return gate;
}

function validatePolicyPreviewReplayVerifierDeletionGate(gate) {
  const normalized = asObject(gate);
  const issues = [];

  if (normalizeString(normalized.version) !==
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_VERSION) {
    issues.push(buildRisk(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.VERSION_MISMATCH,
      'Verifier deletion gate must use the supported version.',
    ));
  }

  const risks = asArray(normalized.risks);
  const derivedStatusId = determineStatusId(risks);

  if (derivedStatusId !== normalizeString(normalized.statusId)) {
    issues.push(buildRisk(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.DERIVED_STATUS_MISMATCH,
      'Verifier deletion gate status must match its risk-derived status.',
    ));
  }

  const expectedReady = risks.length === 0 &&
    derivedStatusId ===
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.READY_FOR_VERIFIER_DELETION;

  if (normalized.readyForDeletion !== expectedReady) {
    issues.push(buildRisk(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.READY_STATUS_INVALID,
      'Verifier deletion gate ready flag must agree with its risks and status.',
    ));
  }

  const deletionPolicy = asObject(normalized.deletionPolicy);
  Object.entries(REQUIRED_DELETION_POLICY).forEach(([key, requiredValue]) => {
    if (deletionPolicy[key] !== requiredValue) {
      issues.push(buildRisk(
        POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.UNSAFE_DELETION_EXECUTION,
        `Verifier deletion gate deletion policy "${key}" must remain ${requiredValue}.`,
      ));
    }
  });

  const sideEffects = asObject(normalized.sideEffects);
  Object.entries(sideEffects).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Verifier deletion gate cannot perform side effect "${key}".`,
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
  POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_VERSION,
  REQUIRED_DELETION_POLICY,
  REQUIRED_EXIT_CRITERION_IDS,
  buildPolicyPreviewReplayVerifierDeletionGate,
  validatePolicyPreviewReplayVerifierDeletionGate,
};
