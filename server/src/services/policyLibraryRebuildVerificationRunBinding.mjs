/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_MIGRATION_PREVIEW_STATUS_IDS,
} from './policyMigrationPreviewContract.mjs';
import {
  POLICY_MIGRATION_VERIFICATION_RUN_DETERMINISTIC_ORDER_ID,
  POLICY_MIGRATION_VERIFICATION_RUN_SOURCE_ID,
} from './policyMigrationVerificationRunContract.mjs';

const POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS = Object.freeze({
  VERIFICATION_RUN_MISSING: 'verification_run_missing',
  VERIFICATION_RUN_CONTEXT_MISMATCH: 'verification_run_context_mismatch',
  VERIFICATION_RUN_STALE: 'verification_run_stale',
  VERIFICATION_RUN_SOURCE_MISMATCH: 'verification_run_source_mismatch',
  VERIFICATION_RUN_AUDIT_INVALID: 'verification_run_audit_invalid',
  VERIFICATION_RUN_FINGERPRINT_INVALID: 'verification_run_fingerprint_invalid',
  VERIFICATION_RUN_REVIEW_REQUIRED: 'verification_run_review_required',
  VERIFICATION_RUN_RISK_BLOCKED: 'verification_run_risk_blocked',
  VERIFICATION_RUN_STATUS_INVALID: 'verification_run_status_invalid',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeString(value, maximumLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function normalizeIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function normalizeVerificationRun(row = {}) {
  const source = asObject(row);

  return {
    id: normalizePositiveInteger(source.id),
    runVersion: normalizePositiveInteger(source.run_version),
    policyId: normalizePositiveInteger(source.policy_id),
    intentId: normalizePositiveInteger(source.intent_id),
    libraryId: normalizePositiveInteger(source.library_id),
    acceptanceTransitionFingerprint: normalizeString(
      source.acceptance_transition_fingerprint,
      64,
    ) || null,
    sourceId: normalizeString(source.source_id, 120) || null,
    sourceMediaType: normalizeString(source.source_media_type, 20).toLowerCase() || null,
    sourceDeterministicOrderId: normalizeString(
      source.source_deterministic_order_id,
      120,
    ) || null,
    sourceMaximumClassifications: normalizeNonNegativeInteger(source.source_maximum_classifications),
    sourceRowsRead: normalizeNonNegativeInteger(source.source_rows_read),
    sourceRowsConsidered: normalizeNonNegativeInteger(source.source_rows_considered),
    sourceRepresentativeClassificationCount: normalizeNonNegativeInteger(
      source.source_representative_classification_count,
    ),
    sourceUnusableSourceRowCount: normalizeNonNegativeInteger(source.source_unusable_source_row_count),
    sourceCoverageSufficient: source.source_coverage_sufficient === true,
    sourceAuditOk: source.source_audit_ok === true,
    sourceAuditIssueCount: normalizeNonNegativeInteger(source.source_audit_issue_count),
    verifierStatusId: normalizeString(source.verifier_status_id, 120) || null,
    verifierFingerprint: normalizeString(source.verifier_fingerprint, 64) || null,
    verifierDifferenceCount: normalizeNonNegativeInteger(source.verifier_difference_count),
    verifierEmittedDifferenceCount: normalizeNonNegativeInteger(
      source.verifier_emitted_difference_count,
    ),
    verifierDifferencesTruncated: source.verifier_differences_truncated === true,
    verifierAuditOk: source.verifier_audit_ok === true,
    verifierAuditIssueCount: normalizeNonNegativeInteger(source.verifier_audit_issue_count),
    coordinatorAuditOk: source.coordinator_audit_ok === true,
    coordinatorAuditIssueCount: normalizeNonNegativeInteger(
      source.coordinator_audit_issue_count,
    ),
    evaluatedAt: normalizeIsoDate(source.evaluated_at),
    createdAt: normalizeIsoDate(source.created_at),
  };
}

function buildBindingIssue(riskId, message) {
  return { riskId, message };
}

function validatePolicyLibraryRebuildVerificationRunBinding({
  verificationRun = null,
  transition = {},
  proposal = {},
} = {}) {
  const run = normalizeVerificationRun(verificationRun || {});
  const context = asObject(transition.policyContext);
  const acceptance = asObject(transition.acceptance);
  const expectedMediaType = normalizeString(asObject(proposal.library).mediaType, 20).toLowerCase();
  const issues = [];

  if (!run.id) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_MISSING,
      'A persisted migration verification receipt is required before rollback evidence can be created.',
    ));
  }

  if (
    run.policyId !== Number(context.policyId) ||
    run.intentId !== Number(context.intentId) ||
    run.libraryId !== Number(context.libraryId) ||
    run.acceptanceTransitionFingerprint !== transition?.transitionFingerprint?.fingerprint
  ) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_CONTEXT_MISMATCH,
      'The latest migration verification receipt does not match the current accepted rebuild transition.',
    ));
  }

  if (!run.evaluatedAt || !acceptance.acceptedAt ||
      new Date(run.evaluatedAt).getTime() < new Date(acceptance.acceptedAt).getTime()) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_STALE,
      'The migration verification receipt predates the current accepted rebuild transition.',
    ));
  }

  if (
    run.runVersion !== 1 ||
    run.sourceId !== POLICY_MIGRATION_VERIFICATION_RUN_SOURCE_ID ||
    run.sourceDeterministicOrderId !== POLICY_MIGRATION_VERIFICATION_RUN_DETERMINISTIC_ORDER_ID ||
    !['movie', 'tv'].includes(expectedMediaType) ||
    run.sourceMediaType !== expectedMediaType ||
    run.sourceMaximumClassifications === null ||
    run.sourceMaximumClassifications < 1 ||
    run.sourceMaximumClassifications > 100 ||
    run.sourceRowsRead === null ||
    run.sourceRowsConsidered === null ||
    run.sourceRepresentativeClassificationCount === null ||
    run.sourceRepresentativeClassificationCount < 1 ||
    run.sourceRepresentativeClassificationCount > run.sourceMaximumClassifications ||
    run.sourceRowsConsidered < run.sourceRepresentativeClassificationCount ||
    run.sourceUnusableSourceRowCount === null ||
    run.sourceCoverageSufficient !== true ||
    run.sourceAuditOk !== true ||
    run.sourceAuditIssueCount !== 0
  ) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_SOURCE_MISMATCH,
      'The migration verification receipt does not retain current bounded source provenance.',
    ));
  }

  if (!SHA256_FINGERPRINT_PATTERN.test(run.verifierFingerprint || '')) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_FINGERPRINT_INVALID,
      'The migration verification receipt does not retain a valid verifier fingerprint.',
    ));
  }

  if (
    run.verifierDifferenceCount === null ||
    run.verifierEmittedDifferenceCount === null ||
    run.verifierDifferenceCount !== 0 ||
    run.verifierEmittedDifferenceCount !== 0 ||
    run.verifierDifferencesTruncated === true ||
    run.verifierAuditOk !== true ||
    run.verifierAuditIssueCount !== 0 ||
    run.coordinatorAuditOk !== true ||
    run.coordinatorAuditIssueCount !== 0
  ) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_AUDIT_INVALID,
      'The migration verification receipt does not retain a zero-issue, no-difference audit summary.',
    ));
  }

  if (run.verifierStatusId === POLICY_MIGRATION_PREVIEW_STATUS_IDS.REVIEW_REQUIRED) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_REVIEW_REQUIRED,
      'The latest migration verification receipt requires review before rollback evidence can be created.',
    ));
  } else if (run.verifierStatusId === POLICY_MIGRATION_PREVIEW_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_RISK_BLOCKED,
      'The latest migration verification receipt is blocked by migration risk.',
    ));
  } else if (run.verifierStatusId !== POLICY_MIGRATION_PREVIEW_STATUS_IDS.NO_MIGRATION_DIFFERENCES) {
    issues.push(buildBindingIssue(
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_STATUS_INVALID,
      'The migration verification receipt is not a no-difference result.',
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    verificationRun: issues.length === 0 && run.id
      ? {
        id: run.id,
        verifierFingerprint: run.verifierFingerprint,
        verifierStatusId: run.verifierStatusId,
      }
      : null,
  };
}

async function lockLatestPolicyMigrationVerificationRun({ client, transition } = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Library rebuild verification binding requires a transaction client.');
  }

  const context = asObject(transition.policyContext);
  const result = await client.query(
    `SELECT
       id,
       run_version,
       policy_id,
       intent_id,
       library_id,
       acceptance_transition_fingerprint,
       source_id,
       source_media_type,
       source_deterministic_order_id,
       source_maximum_classifications,
       source_rows_read,
       source_rows_considered,
       source_representative_classification_count,
       source_unusable_source_row_count,
       source_coverage_sufficient,
       source_audit_ok,
       source_audit_issue_count,
       verifier_status_id,
       verifier_fingerprint,
       verifier_difference_count,
       verifier_emitted_difference_count,
       verifier_differences_truncated,
       verifier_audit_ok,
       verifier_audit_issue_count,
       coordinator_audit_ok,
       coordinator_audit_issue_count,
       evaluated_at,
       created_at
     FROM policy_migration_verification_runs
     WHERE policy_id = $1
       AND intent_id = $2
       AND library_id = $3
     ORDER BY created_at DESC, id DESC
     LIMIT 1
     FOR KEY SHARE`,
    [context.policyId, context.intentId, context.libraryId],
  );

  return firstRow(result);
}

async function loadPolicyLibraryRebuildVerificationRunBinding({
  client,
  transition,
  proposal,
} = {}) {
  const verificationRun = await lockLatestPolicyMigrationVerificationRun({ client, transition });
  const validation = validatePolicyLibraryRebuildVerificationRunBinding({
    verificationRun,
    transition,
    proposal,
  });

  return {
    ...validation,
    verificationRun: validation.ok ? validation.verificationRun : null,
  };
}

export {
  POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS,
  loadPolicyLibraryRebuildVerificationRunBinding,
  lockLatestPolicyMigrationVerificationRun,
  validatePolicyLibraryRebuildVerificationRunBinding,
};
