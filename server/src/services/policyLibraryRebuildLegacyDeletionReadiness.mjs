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
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION,
  validatePolicyLibraryRebuildLegacyRemovalInventory,
} from './policyLibraryRebuildLegacyRemovalInventory.mjs';

const POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_VERSION =
  'policy.library_rebuild_legacy_deletion_readiness.v1';

const POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS = Object.freeze({
  READY_FOR_FINAL_REMOVAL_AUDIT: 'ready_for_final_removal_audit',
  BLOCKED_BY_EVIDENCE_BOUNDARY: 'blocked_by_evidence_boundary',
  BLOCKED_BY_CUTOVER: 'blocked_by_cutover',
  BLOCKED_BY_VERIFICATION_PROVENANCE: 'blocked_by_verification_provenance',
  BLOCKED_BY_ROLLBACK_WINDOW: 'blocked_by_rollback_window',
  BLOCKED_BY_RUNTIME_AUTHORITY: 'blocked_by_runtime_authority',
  BLOCKED_BY_REMOVAL_INVENTORY: 'blocked_by_removal_inventory',
});

const POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS = Object.freeze({
  EVIDENCE_BOUNDARY_UNAVAILABLE: 'evidence_boundary_unavailable',
  POLICY_CONTEXT_INVALID: 'policy_context_invalid',
  EXECUTION_GATE_MISSING: 'execution_gate_missing',
  EXECUTION_NOT_REPLACED: 'execution_not_replaced',
  EXECUTION_CONTEXT_MISMATCH: 'execution_context_mismatch',
  REPLACEMENT_EVENT_MISSING: 'replacement_event_missing',
  REPLACEMENT_EVENT_MISMATCH: 'replacement_event_mismatch',
  VERIFICATION_RECEIPT_MISSING: 'verification_receipt_missing',
  VERIFICATION_RECEIPT_MISMATCH: 'verification_receipt_mismatch',
  VERIFICATION_RECEIPT_INVALID: 'verification_receipt_invalid',
  ROLLBACK_SNAPSHOT_MISSING: 'rollback_snapshot_missing',
  ROLLBACK_SNAPSHOT_MISMATCH: 'rollback_snapshot_mismatch',
  ROLLBACK_WINDOW_OPEN: 'rollback_window_open',
  ROLLBACK_SNAPSHOT_RESTORED: 'rollback_snapshot_restored',
  ROLLBACK_PAYLOAD_NOT_REDACTED: 'rollback_payload_not_redacted',
  RUNTIME_AUTHORITY_MISSING: 'runtime_authority_missing',
  RUNTIME_AUTHORITY_AMBIGUOUS: 'runtime_authority_ambiguous',
  RUNTIME_AUTHORITY_MISMATCH: 'runtime_authority_mismatch',
  REMOVAL_INVENTORY_INVALID: 'removal_inventory_invalid',
  UNSAFE_READINESS_OUTPUT: 'unsafe_readiness_output',
});

const POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS = Object.freeze({
  WINDOW_OPEN: 'window_open',
  SNAPSHOT_RESTORED: 'snapshot_restored',
  RETENTION_REDACTION_REQUIRED: 'retention_redaction_required',
  WINDOW_CLOSED_PAYLOAD_REDACTED: 'window_closed_payload_redacted',
  UNKNOWN: 'unknown',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const REQUIRED_SOURCE_ID = 'persisted_destination_library_final_outcomes';
const REQUIRED_SOURCE_ORDER_ID = 'created_at_desc_id_desc';
const REQUIRED_VERIFIER_STATUS_ID = 'no_migration_differences';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeString(value, maximumLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function normalizeIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeFingerprint(value) {
  const fingerprint = normalizeString(value, 64);
  return SHA256_FINGERPRINT_PATTERN.test(fingerprint) ? fingerprint : null;
}

function pushRisk(risks, riskId) {
  if (!risks.some(risk => risk.riskId === riskId)) {
    risks.push({ riskId });
  }
}

function summarizeExecutionGate(value = {}) {
  const gate = asObject(value);

  return {
    gateId: normalizePositiveInteger(gate.id),
    policyId: normalizePositiveInteger(gate.policy_id ?? gate.policyId),
    originalIntentId: normalizePositiveInteger(gate.intent_id ?? gate.intentId),
    libraryId: normalizePositiveInteger(gate.library_id ?? gate.libraryId),
    stateId: normalizeString(gate.state),
    replacementIntentId: normalizePositiveInteger(
      gate.replacement_intent_id ?? gate.replacementIntentId,
    ),
    replacementEventId: normalizePositiveInteger(
      gate.replacement_event_id ?? gate.replacementEventId,
    ),
    rollbackSnapshotId: normalizePositiveInteger(
      gate.rollback_snapshot_id ?? gate.rollbackSnapshotId,
    ),
    verificationRunId: normalizePositiveInteger(
      gate.verification_run_id ?? gate.verificationRunId,
    ),
    transitionFingerprint: normalizeFingerprint(
      gate.transition_fingerprint ?? gate.transitionFingerprint,
    ),
    proposalFingerprint: normalizeFingerprint(
      gate.proposal_fingerprint ?? gate.proposalFingerprint,
    ),
    verificationRunFingerprint: normalizeFingerprint(
      gate.verification_run_fingerprint ?? gate.verificationRunFingerprint,
    ),
    replacementAppliedAt: normalizeIsoDate(
      gate.replacement_applied_at ?? gate.replacementAppliedAt,
    ),
  };
}

function summarizeVerificationReceipt(value = {}) {
  const receipt = asObject(value);

  return {
    verificationRunId: normalizePositiveInteger(receipt.id),
    policyId: normalizePositiveInteger(receipt.policy_id ?? receipt.policyId),
    originalIntentId: normalizePositiveInteger(receipt.intent_id ?? receipt.intentId),
    libraryId: normalizePositiveInteger(receipt.library_id ?? receipt.libraryId),
    transitionFingerprint: normalizeFingerprint(
      receipt.acceptance_transition_fingerprint ?? receipt.acceptanceTransitionFingerprint,
    ),
    verifierFingerprint: normalizeFingerprint(
      receipt.verifier_fingerprint ?? receipt.verifierFingerprint,
    ),
    verifierStatusId: normalizeString(receipt.verifier_status_id ?? receipt.verifierStatusId),
    sourceId: normalizeString(receipt.source_id ?? receipt.sourceId),
    sourceMediaType: normalizeString(receipt.source_media_type ?? receipt.sourceMediaType),
    sourceDeterministicOrderId: normalizeString(
      receipt.source_deterministic_order_id ?? receipt.sourceDeterministicOrderId,
    ),
    sourceCoverageSufficient:
      (receipt.source_coverage_sufficient ?? receipt.sourceCoverageSufficient) === true,
    sourceAuditOk: (receipt.source_audit_ok ?? receipt.sourceAuditOk) === true,
    sourceAuditIssueCount: Number(
      receipt.source_audit_issue_count ?? receipt.sourceAuditIssueCount,
    ),
    verifierDifferenceCount: Number(
      receipt.verifier_difference_count ?? receipt.verifierDifferenceCount,
    ),
    verifierEmittedDifferenceCount: Number(
      receipt.verifier_emitted_difference_count ?? receipt.verifierEmittedDifferenceCount,
    ),
    verifierDifferencesTruncated:
      (receipt.verifier_differences_truncated ?? receipt.verifierDifferencesTruncated) === true,
    verifierAuditOk: (receipt.verifier_audit_ok ?? receipt.verifierAuditOk) === true,
    verifierAuditIssueCount: Number(
      receipt.verifier_audit_issue_count ?? receipt.verifierAuditIssueCount,
    ),
    coordinatorAuditOk: (receipt.coordinator_audit_ok ?? receipt.coordinatorAuditOk) === true,
    coordinatorAuditIssueCount: Number(
      receipt.coordinator_audit_issue_count ?? receipt.coordinatorAuditIssueCount,
    ),
  };
}

function summarizeRollbackSnapshot(value = {}) {
  const snapshot = asObject(value);

  return {
    rollbackSnapshotId: normalizePositiveInteger(snapshot.id),
    policyId: normalizePositiveInteger(snapshot.policy_id ?? snapshot.policyId),
    originalIntentId: normalizePositiveInteger(snapshot.intent_id ?? snapshot.intentId),
    payloadRedacted: (snapshot.payload_redacted ?? snapshot.payloadRedacted) === true,
    expiresAt: normalizeIsoDate(snapshot.expires_at ?? snapshot.expiresAt),
    restoredAt: normalizeIsoDate(snapshot.restored_at ?? snapshot.restoredAt),
  };
}

function summarizeReplacementEvent(value = {}) {
  const event = asObject(value);

  return {
    replacementEventId: normalizePositiveInteger(event.id),
    policyId: normalizePositiveInteger(event.policy_id ?? event.policyId),
    replacementIntentId: normalizePositiveInteger(event.intent_id ?? event.intentId),
    eventType: normalizeString(event.event_type ?? event.eventType),
    executionGateId: normalizePositiveInteger(event.execution_gate_id ?? event.executionGateId),
    rollbackSnapshotId: normalizePositiveInteger(event.rollback_snapshot_id ?? event.rollbackSnapshotId),
    verificationRunId: normalizePositiveInteger(event.verification_run_id ?? event.verificationRunId),
    transitionFingerprint: normalizeFingerprint(
      event.transition_fingerprint ?? event.transitionFingerprint,
    ),
    verifierFingerprint: normalizeFingerprint(
      event.verification_run_fingerprint ?? event.verificationRunFingerprint,
    ),
  };
}

function summarizeAuthority(activeNativeIntents = []) {
  const intents = asArray(activeNativeIntents).map(intent => asObject(intent));
  const activeIntentIds = intents
    .map(intent => normalizePositiveInteger(intent.id))
    .filter(Boolean);

  return {
    activeNativeIntentCount: activeIntentIds.length,
    activeNativeIntentId: activeIntentIds.length === 1 ? activeIntentIds[0] : null,
  };
}

function summarizeRemovalInventory(value = {}) {
  const inventory = asObject(value);

  return {
    version: normalizeString(inventory.version),
    statusId: normalizeString(inventory.statusId),
    candidateCount: Number.isInteger(inventory.candidateCount) ? inventory.candidateCount : null,
    inventoryFingerprint: normalizeFingerprint(inventory.inventoryFingerprint),
    validationOk: inventory.validation?.ok === true,
  };
}

function determineRollbackDisposition(snapshot, now) {
  if (!snapshot.rollbackSnapshotId || !snapshot.expiresAt) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS.UNKNOWN;
  }

  if (snapshot.restoredAt) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS.SNAPSHOT_RESTORED;
  }

  if (new Date(snapshot.expiresAt).getTime() > now.getTime()) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS.WINDOW_OPEN;
  }

  return snapshot.payloadRedacted
    ? POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS
      .WINDOW_CLOSED_PAYLOAD_REDACTED
    : POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS
      .RETENTION_REDACTION_REQUIRED;
}

function determineStatusId(risks) {
  if (risks.some(risk => risk.riskId ===
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.EVIDENCE_BOUNDARY_UNAVAILABLE)) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY;
  }

  if (risks.some(risk => [
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.POLICY_CONTEXT_INVALID,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.EXECUTION_GATE_MISSING,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.EXECUTION_NOT_REPLACED,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.EXECUTION_CONTEXT_MISMATCH,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.REPLACEMENT_EVENT_MISSING,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.REPLACEMENT_EVENT_MISMATCH,
  ].includes(risk.riskId))) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_CUTOVER;
  }

  if (risks.some(risk => [
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.VERIFICATION_RECEIPT_MISSING,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.VERIFICATION_RECEIPT_MISMATCH,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.VERIFICATION_RECEIPT_INVALID,
  ].includes(risk.riskId))) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS
      .BLOCKED_BY_VERIFICATION_PROVENANCE;
  }

  if (risks.some(risk => [
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_SNAPSHOT_MISSING,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_SNAPSHOT_MISMATCH,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_WINDOW_OPEN,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_SNAPSHOT_RESTORED,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_PAYLOAD_NOT_REDACTED,
  ].includes(risk.riskId))) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_ROLLBACK_WINDOW;
  }

  if (risks.some(risk => [
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.RUNTIME_AUTHORITY_MISSING,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.RUNTIME_AUTHORITY_AMBIGUOUS,
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.RUNTIME_AUTHORITY_MISMATCH,
  ].includes(risk.riskId))) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_RUNTIME_AUTHORITY;
  }

  if (risks.some(risk => risk.riskId ===
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.REMOVAL_INVENTORY_INVALID)) {
    return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_REMOVAL_INVENTORY;
  }

  return POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.READY_FOR_FINAL_REMOVAL_AUDIT;
}

function buildPolicyLibraryRebuildLegacyDeletionReadiness({
  policy = null,
  executionGate = null,
  verificationReceipt = null,
  rollbackSnapshot = null,
  replacementEvent = null,
  activeNativeIntents = [],
  removalInventory = null,
  evidenceBoundaryAvailable = true,
  now = new Date(),
} = {}) {
  const evaluatedAt = normalizeIsoDate(now) || new Date().toISOString();
  const executionTime = new Date(evaluatedAt);
  const policyContext = asObject(policy);
  const policyId = normalizePositiveInteger(policyContext.id ?? policyContext.policyId);
  const libraryId = normalizePositiveInteger(policyContext.library_id ?? policyContext.libraryId);
  const execution = summarizeExecutionGate(executionGate);
  const receipt = summarizeVerificationReceipt(verificationReceipt);
  const snapshot = summarizeRollbackSnapshot(rollbackSnapshot);
  const event = summarizeReplacementEvent(replacementEvent);
  const authority = summarizeAuthority(activeNativeIntents);
  const inventory = summarizeRemovalInventory(removalInventory);
  const rollbackDisposition = determineRollbackDisposition(snapshot, executionTime);
  const risks = [];

  if (evidenceBoundaryAvailable !== true) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.EVIDENCE_BOUNDARY_UNAVAILABLE);
  }

  if (!policyId || !libraryId) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.POLICY_CONTEXT_INVALID);
  }

  if (!execution.gateId) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.EXECUTION_GATE_MISSING);
  } else if (execution.stateId !== 'replacement_applied') {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.EXECUTION_NOT_REPLACED);
  }

  if (!execution.gateId || execution.policyId !== policyId || execution.libraryId !== libraryId ||
      !execution.originalIntentId || !execution.replacementIntentId ||
      !execution.replacementEventId || !execution.rollbackSnapshotId ||
      !execution.verificationRunId || !execution.transitionFingerprint ||
      !execution.proposalFingerprint || !execution.verificationRunFingerprint ||
      !execution.replacementAppliedAt) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.EXECUTION_CONTEXT_MISMATCH);
  }

  if (!event.replacementEventId) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.REPLACEMENT_EVENT_MISSING);
  } else if (event.replacementEventId !== execution.replacementEventId ||
      event.policyId !== execution.policyId ||
      event.replacementIntentId !== execution.replacementIntentId ||
      event.eventType !== 'library_rebuild_replacement_applied' ||
      event.executionGateId !== execution.gateId ||
      event.rollbackSnapshotId !== execution.rollbackSnapshotId ||
      event.verificationRunId !== execution.verificationRunId ||
      event.transitionFingerprint !== execution.transitionFingerprint ||
      event.verifierFingerprint !== execution.verificationRunFingerprint) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.REPLACEMENT_EVENT_MISMATCH);
  }

  if (!receipt.verificationRunId) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.VERIFICATION_RECEIPT_MISSING);
  } else if (receipt.verificationRunId !== execution.verificationRunId ||
      receipt.policyId !== execution.policyId ||
      receipt.originalIntentId !== execution.originalIntentId ||
      receipt.libraryId !== execution.libraryId ||
      receipt.transitionFingerprint !== execution.transitionFingerprint ||
      receipt.verifierFingerprint !== execution.verificationRunFingerprint) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.VERIFICATION_RECEIPT_MISMATCH);
  } else if (receipt.verifierStatusId !== REQUIRED_VERIFIER_STATUS_ID ||
      receipt.sourceId !== REQUIRED_SOURCE_ID ||
      !['movie', 'tv'].includes(receipt.sourceMediaType) ||
      receipt.sourceDeterministicOrderId !== REQUIRED_SOURCE_ORDER_ID ||
      receipt.sourceCoverageSufficient !== true || receipt.sourceAuditOk !== true ||
      receipt.sourceAuditIssueCount !== 0 || receipt.verifierDifferenceCount !== 0 ||
      receipt.verifierEmittedDifferenceCount !== 0 || receipt.verifierDifferencesTruncated === true ||
      receipt.verifierAuditOk !== true || receipt.verifierAuditIssueCount !== 0 ||
      receipt.coordinatorAuditOk !== true || receipt.coordinatorAuditIssueCount !== 0) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.VERIFICATION_RECEIPT_INVALID);
  }

  if (!snapshot.rollbackSnapshotId) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_SNAPSHOT_MISSING);
  } else if (snapshot.rollbackSnapshotId !== execution.rollbackSnapshotId ||
      snapshot.policyId !== execution.policyId || snapshot.originalIntentId !== execution.originalIntentId) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_SNAPSHOT_MISMATCH);
  } else if (rollbackDisposition ===
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS.WINDOW_OPEN) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_WINDOW_OPEN);
  } else if (rollbackDisposition ===
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS.SNAPSHOT_RESTORED) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_SNAPSHOT_RESTORED);
  } else if (rollbackDisposition !==
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS.WINDOW_CLOSED_PAYLOAD_REDACTED) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_PAYLOAD_NOT_REDACTED);
  }

  if (authority.activeNativeIntentCount === 0) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.RUNTIME_AUTHORITY_MISSING);
  } else if (authority.activeNativeIntentCount !== 1) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.RUNTIME_AUTHORITY_AMBIGUOUS);
  } else if (authority.activeNativeIntentId !== execution.replacementIntentId) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.RUNTIME_AUTHORITY_MISMATCH);
  }

  const inventoryValidation = validatePolicyLibraryRebuildLegacyRemovalInventory(removalInventory);
  if (inventory.version !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION ||
      inventory.statusId !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.READY ||
      inventory.candidateCount === null || inventory.candidateCount < 1 ||
      !inventory.inventoryFingerprint || inventory.validationOk !== true ||
      !inventoryValidation.ok) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.REMOVAL_INVENTORY_INVALID);
  }

  const statusId = determineStatusId(risks);
  const readiness = {
    version: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_VERSION,
    statusId,
    evaluatedAt,
    readyForFinalRemovalAudit: statusId ===
      POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.READY_FOR_FINAL_REMOVAL_AUDIT,
    policy: {
      policyId,
      libraryId,
    },
    cutover: execution.gateId ? {
      gateId: execution.gateId,
      originalIntentId: execution.originalIntentId,
      replacementIntentId: execution.replacementIntentId,
      replacementEventId: execution.replacementEventId,
      transitionFingerprint: execution.transitionFingerprint,
      proposalFingerprint: execution.proposalFingerprint,
      appliedAt: execution.replacementAppliedAt,
    } : null,
    verification: receipt.verificationRunId ? {
      verificationRunId: receipt.verificationRunId,
      verifierFingerprint: receipt.verifierFingerprint,
      verifierStatusId: receipt.verifierStatusId || null,
    } : null,
    rollback: {
      rollbackSnapshotId: snapshot.rollbackSnapshotId,
      dispositionId: rollbackDisposition,
      expiresAt: snapshot.expiresAt,
    },
    runtimeAuthority: authority,
    removalInventory: inventory,
    riskCount: risks.length,
    risks,
    sideEffects: {
      databaseRead: false,
      readinessPersisted: false,
      legacyPathsDeleted: false,
      legacyPathsHidden: false,
      legacyPathsArchived: false,
      routingWritten: false,
      browserControlsRendered: false,
    },
    nextStep: statusId === POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS
      .READY_FOR_FINAL_REMOVAL_AUDIT
      ? {
        stepId: 'library_rebuild_legacy_path_final_removal_audit',
        label: 'Library Rebuild Legacy-Path Final Removal Audit',
      }
      : {
        stepId: 'library_rebuild_legacy_deletion_readiness_recheck',
        label: 'Recheck Library Rebuild Deletion Readiness',
      },
  };

  return {
    ...readiness,
    validation: validatePolicyLibraryRebuildLegacyDeletionReadiness(readiness),
  };
}

function validatePolicyLibraryRebuildLegacyDeletionReadiness(readiness = {}) {
  const result = asObject(readiness);
  const risks = asArray(result.risks);
  const sideEffects = asObject(result.sideEffects);
  const issues = [];
  const expectedStatusId = determineStatusId(risks);
  const ready = expectedStatusId ===
    POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.READY_FOR_FINAL_REMOVAL_AUDIT;

  if (result.version !== POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_VERSION ||
      !Object.values(POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS)
        .includes(result.statusId) || !normalizeIsoDate(result.evaluatedAt) ||
      result.riskCount !== risks.length || result.statusId !== expectedStatusId ||
      result.readyForFinalRemovalAudit !== ready) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.UNSAFE_READINESS_OUTPUT,
    });
  }

  if (sideEffects.readinessPersisted === true || sideEffects.legacyPathsDeleted === true ||
      sideEffects.legacyPathsHidden === true || sideEffects.legacyPathsArchived === true ||
      sideEffects.routingWritten === true || sideEffects.browserControlsRendered === true ||
      Object.hasOwn(result, 'executionGate') || Object.hasOwn(result, 'verificationReceipt') ||
      Object.hasOwn(result, 'rollbackSnapshot') || Object.hasOwn(result, 'replacementEvent') ||
      Object.hasOwn(result, 'activeNativeIntents')) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.UNSAFE_READINESS_OUTPUT,
    });
  }

  if (ready && (!result.cutover?.gateId || !result.verification?.verificationRunId ||
      result.rollback?.dispositionId !== POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS
        .WINDOW_CLOSED_PAYLOAD_REDACTED ||
      result.runtimeAuthority?.activeNativeIntentCount !== 1 ||
      result.runtimeAuthority?.activeNativeIntentId !== result.cutover?.replacementIntentId ||
      result.removalInventory?.version !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION ||
      result.removalInventory?.statusId !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS
        .READY ||
      result.removalInventory?.candidateCount < 1 ||
      result.removalInventory?.validationOk !== true ||
      !SHA256_FINGERPRINT_PATTERN.test(result.removalInventory?.inventoryFingerprint || ''))) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.UNSAFE_READINESS_OUTPUT,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLibraryRebuildLegacyDeletionReadinessAudit(readiness = {}) {
  const validation = validatePolicyLibraryRebuildLegacyDeletionReadiness(readiness);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: normalizeString(asObject(readiness).statusId) || null,
    readyForFinalRemovalAudit: asObject(readiness).readyForFinalRemovalAudit === true,
    legacyDeletionAuthorized: false,
    validation,
    nextStep: {
      stepId: 'library_rebuild_legacy_path_final_removal_audit',
      label: 'Library Rebuild Legacy-Path Final Removal Audit',
      reason: 'Readiness evidence is advisory only; a later final audit must re-check it before any removal operation is considered.',
    },
  };
}

export {
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_VERSION,
  buildPolicyLibraryRebuildLegacyDeletionReadiness,
  buildPolicyLibraryRebuildLegacyDeletionReadinessAudit,
  validatePolicyLibraryRebuildLegacyDeletionReadiness,
};
