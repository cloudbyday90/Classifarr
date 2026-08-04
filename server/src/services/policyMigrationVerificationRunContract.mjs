/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

import {
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS,
  buildPolicyMigrationVerificationCoordinatorAudit,
} from './policyMigrationVerificationCoordinatorContract.mjs';
import {
  POLICY_MIGRATION_PREVIEW_STATUS_IDS,
} from './policyMigrationPreviewContract.mjs';

const POLICY_MIGRATION_VERIFICATION_RUN_VERSION =
  'policy.migration_verification_run.v1';
const POLICY_MIGRATION_VERIFICATION_RUN_SCHEMA_VERSION = 1;

const POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS = Object.freeze({
  PERSISTED: 'persisted',
  REPLAYED: 'replayed',
  BOUNDARY_REJECTED: 'boundary_rejected',
  NOT_READY: 'not_ready',
  COORDINATOR_AUDIT_FAILED: 'coordinator_audit_failed',
  PERSISTENCE_BOUNDARY_UNAVAILABLE: 'persistence_boundary_unavailable',
  PERSISTENCE_FAILED: 'persistence_failed',
});

const POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS = Object.freeze({
  VERIFICATION_BOUNDARY_REJECTED: 'verification_boundary_rejected',
  INVALID_COORDINATOR_RESULT: 'invalid_coordinator_result',
  COORDINATOR_NOT_READY: 'coordinator_not_ready',
  MISSING_VERIFIER_FINGERPRINT: 'missing_verifier_fingerprint',
  MALFORMED_VERIFIER_FINGERPRINT: 'malformed_verifier_fingerprint',
  INVALID_SOURCE_SUMMARY: 'invalid_source_summary',
  UNSAFE_HANDOFF_OUTPUT: 'unsafe_handoff_output',
  REPOSITORY_CONFLICT: 'repository_conflict',
  PERSISTENCE_BOUNDARY_UNAVAILABLE: 'persistence_boundary_unavailable',
  PERSISTENCE_FAILED: 'persistence_failed',
  FORBIDDEN_SIDE_EFFECT: 'forbidden_side_effect',
  RAW_SAMPLE_OUTPUT_EXPOSED: 'raw_sample_output_exposed',
});

const POLICY_MIGRATION_VERIFICATION_RUN_SOURCE_ID =
  'persisted_destination_library_final_outcomes';
const POLICY_MIGRATION_VERIFICATION_RUN_DETERMINISTIC_ORDER_ID =
  'created_at_desc_id_desc';
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const ALLOWED_VERIFIER_STATUS_IDS = new Set(
  Object.values(POLICY_MIGRATION_PREVIEW_STATUS_IDS)
);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeIsoDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildIssue(riskId) {
  return { riskId };
}

function summarizeAudit(value = {}) {
  const audit = asObject(value);

  return {
    ok: audit.ok === true,
    issueCount: normalizeNonNegativeInteger(audit.issueCount),
  };
}

function summarizeCoordinator(coordinatorResult = {}) {
  const coordinator = asObject(coordinatorResult);
  const policyContext = asObject(coordinator.policyContext);
  const source = asObject(coordinator.source);
  const sourceSummary = asObject(source.summary);
  const sourceProvenance = asObject(source.provenance);
  const verification = asObject(coordinator.verification);
  const verifier = asObject(verification.verifier);
  const verifierReport = asObject(coordinator.verifierReport);
  const sampleSetFingerprint = asObject(verifierReport.sampleSetFingerprint);
  const differenceSummary = asObject(verifier.differenceSummary);

  return {
    statusId: normalizeString(coordinator.statusId, 120) || null,
    ok: coordinator.ok === true,
    evaluatedAt: normalizeIsoDate(coordinator.evaluatedAt),
    policyContext: {
      policyId: normalizePositiveInteger(policyContext.policyId),
      intentId: normalizePositiveInteger(policyContext.intentId),
      libraryId: normalizePositiveInteger(policyContext.libraryId),
    },
    acceptanceTransitionFingerprint: normalizeString(
      asObject(coordinator.acceptanceTransition).fingerprint,
      64,
    ) || null,
    source: {
      statusId: normalizeString(source.statusId, 120) || null,
      ready: source.ready === true,
      sourceId: normalizeString(sourceProvenance.sourceId, 120) || null,
      mediaType: normalizeString(sourceProvenance.mediaType, 20).toLowerCase() || null,
      deterministicOrderId: normalizeString(sourceProvenance.deterministicOrderId, 120) || null,
      maximumClassifications: normalizeNonNegativeInteger(sourceSummary.maximumClassifications),
      sourceRowsRead: normalizeNonNegativeInteger(sourceSummary.sourceRowsRead),
      sourceRowsConsidered: normalizeNonNegativeInteger(sourceSummary.sourceRowsConsidered),
      representativeClassificationCount: normalizeNonNegativeInteger(
        sourceSummary.representativeClassificationCount,
      ),
      unusableSourceRowCount: normalizeNonNegativeInteger(sourceSummary.unusableSourceRowCount),
      sourceRowsTruncated: sourceSummary.sourceRowsTruncated === true,
      coverageSufficient: sourceSummary.coverageSufficient === true,
      audit: summarizeAudit(source.audit),
    },
    verifier: {
      statusId: normalizeString(verifier.statusId, 120) || null,
      fingerprint: normalizeString(sampleSetFingerprint.fingerprint, 64) || null,
      differenceCount: normalizeNonNegativeInteger(differenceSummary.totalCount),
      emittedDifferenceCount: normalizeNonNegativeInteger(differenceSummary.emittedCount),
      differencesTruncated: differenceSummary.truncated === true,
      audit: summarizeAudit(verifier.audit),
    },
  };
}

function summarizeVerificationRun(value = {}) {
  const run = asObject(value);

  return {
    id: normalizePositiveInteger(run.id),
    runVersion: normalizePositiveInteger(run.runVersion ?? run.run_version),
    policyId: normalizePositiveInteger(run.policyId ?? run.policy_id),
    intentId: normalizePositiveInteger(run.intentId ?? run.intent_id),
    libraryId: normalizePositiveInteger(run.libraryId ?? run.library_id),
    acceptanceTransitionFingerprint: normalizeString(
      run.acceptanceTransitionFingerprint ?? run.acceptance_transition_fingerprint,
      64,
    ) || null,
    sourceId: normalizeString(run.sourceId ?? run.source_id, 120) || null,
    sourceMediaType: normalizeString(run.sourceMediaType ?? run.source_media_type, 20) || null,
    sourceDeterministicOrderId: normalizeString(
      run.sourceDeterministicOrderId ?? run.source_deterministic_order_id,
      120,
    ) || null,
    verifierStatusId: normalizeString(run.verifierStatusId ?? run.verifier_status_id, 120) || null,
    verifierFingerprint: normalizeString(
      run.verifierFingerprint ?? run.verifier_fingerprint,
      64,
    ) || null,
    evaluatedAt: normalizeIsoDate(run.evaluatedAt ?? run.evaluated_at),
    createdAt: normalizeIsoDate(run.createdAt ?? run.created_at),
  };
}

function validateCoordinatorForPersistence(coordinatorResult = {}) {
  const coordinatorAudit = buildPolicyMigrationVerificationCoordinatorAudit(coordinatorResult);
  const summary = summarizeCoordinator(coordinatorResult);
  const issues = [];

  if (!coordinatorAudit.ok) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.INVALID_COORDINATOR_RESULT));
  }

  if (summary.statusId !== POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY ||
      summary.ok !== true) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.COORDINATOR_NOT_READY));
  }

  if (!summary.policyContext.policyId || !summary.policyContext.intentId ||
      !summary.policyContext.libraryId ||
      !summary.evaluatedAt ||
      !SHA256_FINGERPRINT_PATTERN.test(summary.acceptanceTransitionFingerprint || '')) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.INVALID_COORDINATOR_RESULT));
  }

  if (!summary.verifier.fingerprint) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.MISSING_VERIFIER_FINGERPRINT));
  } else if (!SHA256_FINGERPRINT_PATTERN.test(summary.verifier.fingerprint)) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.MALFORMED_VERIFIER_FINGERPRINT));
  }

  if (!ALLOWED_VERIFIER_STATUS_IDS.has(summary.verifier.statusId) ||
      summary.verifier.audit.ok !== true || summary.verifier.audit.issueCount !== 0 ||
      summary.verifier.differenceCount === null || summary.verifier.emittedDifferenceCount === null ||
      summary.verifier.emittedDifferenceCount > summary.verifier.differenceCount) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.INVALID_COORDINATOR_RESULT));
  }

  const source = summary.source;
  if (source.statusId !== 'ready' || source.ready !== true ||
      source.sourceId !== POLICY_MIGRATION_VERIFICATION_RUN_SOURCE_ID ||
      source.deterministicOrderId !== POLICY_MIGRATION_VERIFICATION_RUN_DETERMINISTIC_ORDER_ID ||
      !['movie', 'tv'].includes(source.mediaType) ||
      source.audit.ok !== true || source.audit.issueCount !== 0 ||
      source.maximumClassifications === null || source.maximumClassifications < 1 ||
      source.maximumClassifications > 100 ||
      source.sourceRowsRead === null || source.sourceRowsConsidered === null ||
      source.representativeClassificationCount === null ||
      source.unusableSourceRowCount === null || source.coverageSufficient !== true ||
      source.representativeClassificationCount < 1 ||
      source.representativeClassificationCount > source.maximumClassifications ||
      source.sourceRowsConsidered < source.representativeClassificationCount) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.INVALID_SOURCE_SUMMARY));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    coordinatorAudit: {
      ok: coordinatorAudit.ok,
      issueCount: normalizeNonNegativeInteger(coordinatorAudit.issueCount) ?? 0,
    },
    summary,
  };
}

function buildPolicyMigrationVerificationRunRecord(coordinatorResult = {}) {
  const validation = validateCoordinatorForPersistence(coordinatorResult);
  if (!validation.ok) {
    throw new TypeError('Migration verification runs require a ready, audited coordinator result.');
  }

  const { summary, coordinatorAudit } = validation;
  const recordInput = {
    version: POLICY_MIGRATION_VERIFICATION_RUN_VERSION,
    policyContext: summary.policyContext,
    acceptanceTransitionFingerprint: summary.acceptanceTransitionFingerprint,
    source: summary.source,
    verifier: summary.verifier,
  };

  return {
    runVersion: POLICY_MIGRATION_VERIFICATION_RUN_SCHEMA_VERSION,
    policyId: summary.policyContext.policyId,
    intentId: summary.policyContext.intentId,
    libraryId: summary.policyContext.libraryId,
    acceptanceTransitionFingerprint: summary.acceptanceTransitionFingerprint,
    sourceId: summary.source.sourceId,
    sourceMediaType: summary.source.mediaType,
    sourceDeterministicOrderId: summary.source.deterministicOrderId,
    sourceMaximumClassifications: summary.source.maximumClassifications,
    sourceRowsRead: summary.source.sourceRowsRead,
    sourceRowsConsidered: summary.source.sourceRowsConsidered,
    sourceRepresentativeClassificationCount: summary.source.representativeClassificationCount,
    sourceUnusableSourceRowCount: summary.source.unusableSourceRowCount,
    sourceRowsTruncated: summary.source.sourceRowsTruncated,
    sourceCoverageSufficient: summary.source.coverageSufficient,
    sourceAuditOk: summary.source.audit.ok,
    sourceAuditIssueCount: summary.source.audit.issueCount,
    verifierStatusId: summary.verifier.statusId,
    verifierFingerprint: summary.verifier.fingerprint,
    verifierDifferenceCount: summary.verifier.differenceCount,
    verifierEmittedDifferenceCount: summary.verifier.emittedDifferenceCount,
    verifierDifferencesTruncated: summary.verifier.differencesTruncated,
    verifierAuditOk: summary.verifier.audit.ok,
    verifierAuditIssueCount: summary.verifier.audit.issueCount,
    coordinatorAuditOk: coordinatorAudit.ok,
    coordinatorAuditIssueCount: coordinatorAudit.issueCount,
    evaluatedAt: summary.evaluatedAt,
    idempotencyKey: `policy:migration_verification:${sha256(recordInput)}`,
  };
}

function buildPolicyMigrationVerificationRunResult({
  statusId,
  coordinatorResult = {},
  verificationRun = null,
  persistenceError = null,
} = {}) {
  const coordinatorSummary = summarizeCoordinator(coordinatorResult);
  const safeVerificationRun = verificationRun ? summarizeVerificationRun(verificationRun) : null;
  const persisted = statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED;
  const replayed = statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.REPLAYED;
  const riskId = persistenceError ||
    (statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.BOUNDARY_REJECTED
      ? POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.VERIFICATION_BOUNDARY_REJECTED
      : statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.NOT_READY
      ? POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.COORDINATOR_NOT_READY
      : statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.COORDINATOR_AUDIT_FAILED
        ? POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.INVALID_COORDINATOR_RESULT
        : statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_BOUNDARY_UNAVAILABLE
          ? POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.PERSISTENCE_BOUNDARY_UNAVAILABLE
          : statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_FAILED
            ? POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.PERSISTENCE_FAILED
            : null);

  return {
    version: POLICY_MIGRATION_VERIFICATION_RUN_VERSION,
    statusId,
    ok: persisted || replayed,
    persisted,
    replayed,
    coordinator: {
      statusId: coordinatorSummary.statusId,
      policyContext: coordinatorSummary.policyContext,
      acceptanceTransitionFingerprint: coordinatorSummary.acceptanceTransitionFingerprint,
    },
    verificationRun: safeVerificationRun,
    normalWorkflowSurface: false,
    sideEffects: {
      databaseRead: asObject(coordinatorResult).sideEffects?.databaseRead === true,
      verificationRunPersisted: persisted,
      snapshotCreated: false,
      policyReplaced: false,
      policyDeleted: false,
      routingWritten: false,
      browserControlsRendered: false,
    },
    issueCount: riskId ? 1 : 0,
    issues: riskId ? [buildIssue(riskId)] : [],
  };
}

function validatePolicyMigrationVerificationRunResult(result = {}) {
  const handoff = asObject(result);
  const statusId = normalizeString(handoff.statusId, 120);
  const sideEffects = asObject(handoff.sideEffects);
  const verificationRun = handoff.verificationRun;
  const allowedStatuses = new Set(Object.values(POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS));
  const issues = [];

  if (handoff.version !== POLICY_MIGRATION_VERIFICATION_RUN_VERSION || !allowedStatuses.has(statusId)) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.UNSAFE_HANDOFF_OUTPUT));
  }

  if (Object.hasOwn(handoff, 'representativeClassifications') ||
      Object.hasOwn(handoff, 'verifierReport') || Object.hasOwn(handoff, 'sourceResult') ||
      Object.hasOwn(asObject(verificationRun), 'representativeClassifications') ||
      Object.hasOwn(asObject(verificationRun), 'verifierReport')) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.RAW_SAMPLE_OUTPUT_EXPOSED));
  }

  if (handoff.normalWorkflowSurface !== false ||
      sideEffects.snapshotCreated === true || sideEffects.policyReplaced === true ||
      sideEffects.policyDeleted === true || sideEffects.routingWritten === true ||
      sideEffects.browserControlsRendered === true) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.FORBIDDEN_SIDE_EFFECT));
  }

  const requiresReceipt = [
    POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED,
    POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.REPLAYED,
  ].includes(statusId);
  if (requiresReceipt !== (handoff.ok === true) ||
      requiresReceipt !== (handoff.persisted === true || handoff.replayed === true) ||
      (statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED &&
        (handoff.persisted !== true || handoff.replayed === true)) ||
      (statusId === POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.REPLAYED &&
        (handoff.persisted === true || handoff.replayed !== true))) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.UNSAFE_HANDOFF_OUTPUT));
  }

  if (requiresReceipt && (!verificationRun ||
      !SHA256_FINGERPRINT_PATTERN.test(normalizeString(
        asObject(verificationRun).acceptanceTransitionFingerprint,
        64,
      )) ||
      !SHA256_FINGERPRINT_PATTERN.test(normalizeString(
        asObject(verificationRun).verifierFingerprint,
        64,
      )))) {
    issues.push(buildIssue(POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.UNSAFE_HANDOFF_OUTPUT));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyMigrationVerificationRunAudit(result = {}) {
  const validation = validatePolicyMigrationVerificationRunResult(result);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: asObject(result).statusId || null,
    persisted: asObject(result).persisted === true,
    replayed: asObject(result).replayed === true,
    validation,
    nextStep: {
      stepId: 'library_rebuild_snapshot_gate_verification_binding',
      label: 'Library Rebuild Snapshot Gate Verification Binding',
      reason: 'The snapshot gate must consume one matching persisted verification receipt before it can create rollback evidence.',
    },
  };
}

export {
  POLICY_MIGRATION_VERIFICATION_RUN_DETERMINISTIC_ORDER_ID,
  POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS,
  POLICY_MIGRATION_VERIFICATION_RUN_SCHEMA_VERSION,
  POLICY_MIGRATION_VERIFICATION_RUN_SOURCE_ID,
  POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS,
  POLICY_MIGRATION_VERIFICATION_RUN_VERSION,
  buildPolicyMigrationVerificationRunAudit,
  buildPolicyMigrationVerificationRunRecord,
  buildPolicyMigrationVerificationRunResult,
  summarizeVerificationRun,
  validateCoordinatorForPersistence,
  validatePolicyMigrationVerificationRunResult,
};
