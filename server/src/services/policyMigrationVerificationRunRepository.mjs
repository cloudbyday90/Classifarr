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
  buildPolicyMigrationVerificationRunRecord,
} from './policyMigrationVerificationRunContract.mjs';

const POLICY_MIGRATION_VERIFICATION_RUN_TABLE = 'policy_migration_verification_runs';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

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

function normalizeVerificationRunRow(row = {}) {
  const source = asObject(row);

  return {
    id: normalizePositiveInteger(source.id),
    runVersion: normalizePositiveInteger(source.run_version ?? source.runVersion),
    policyId: normalizePositiveInteger(source.policy_id ?? source.policyId),
    intentId: normalizePositiveInteger(source.intent_id ?? source.intentId),
    libraryId: normalizePositiveInteger(source.library_id ?? source.libraryId),
    acceptanceTransitionFingerprint: normalizeString(
      source.acceptance_transition_fingerprint ?? source.acceptanceTransitionFingerprint,
      64,
    ) || null,
    sourceId: normalizeString(source.source_id ?? source.sourceId, 120) || null,
    sourceMediaType: normalizeString(source.source_media_type ?? source.sourceMediaType, 20) || null,
    sourceDeterministicOrderId: normalizeString(
      source.source_deterministic_order_id ?? source.sourceDeterministicOrderId,
      120,
    ) || null,
    sourceMaximumClassifications: normalizeNonNegativeInteger(
      source.source_maximum_classifications ?? source.sourceMaximumClassifications,
    ),
    sourceRowsRead: normalizeNonNegativeInteger(source.source_rows_read ?? source.sourceRowsRead),
    sourceRowsConsidered: normalizeNonNegativeInteger(
      source.source_rows_considered ?? source.sourceRowsConsidered,
    ),
    sourceRepresentativeClassificationCount: normalizeNonNegativeInteger(
      source.source_representative_classification_count ??
        source.sourceRepresentativeClassificationCount,
    ),
    sourceUnusableSourceRowCount: normalizeNonNegativeInteger(
      source.source_unusable_source_row_count ?? source.sourceUnusableSourceRowCount,
    ),
    sourceRowsTruncated: (source.source_rows_truncated ?? source.sourceRowsTruncated) === true,
    sourceCoverageSufficient:
      (source.source_coverage_sufficient ?? source.sourceCoverageSufficient) === true,
    sourceAuditOk: (source.source_audit_ok ?? source.sourceAuditOk) === true,
    sourceAuditIssueCount: normalizeNonNegativeInteger(
      source.source_audit_issue_count ?? source.sourceAuditIssueCount,
    ),
    verifierStatusId: normalizeString(source.verifier_status_id ?? source.verifierStatusId, 120) || null,
    verifierFingerprint: normalizeString(
      source.verifier_fingerprint ?? source.verifierFingerprint,
      64,
    ) || null,
    verifierDifferenceCount: normalizeNonNegativeInteger(
      source.verifier_difference_count ?? source.verifierDifferenceCount,
    ),
    verifierEmittedDifferenceCount: normalizeNonNegativeInteger(
      source.verifier_emitted_difference_count ?? source.verifierEmittedDifferenceCount,
    ),
    verifierDifferencesTruncated:
      (source.verifier_differences_truncated ?? source.verifierDifferencesTruncated) === true,
    verifierAuditOk: (source.verifier_audit_ok ?? source.verifierAuditOk) === true,
    verifierAuditIssueCount: normalizeNonNegativeInteger(
      source.verifier_audit_issue_count ?? source.verifierAuditIssueCount,
    ),
    coordinatorAuditOk: (source.coordinator_audit_ok ?? source.coordinatorAuditOk) === true,
    coordinatorAuditIssueCount: normalizeNonNegativeInteger(
      source.coordinator_audit_issue_count ?? source.coordinatorAuditIssueCount,
    ),
    idempotencyKey: normalizeString(source.idempotency_key ?? source.idempotencyKey, 160) || null,
    evaluatedAt: source.evaluated_at ?? source.evaluatedAt ?? null,
    createdAt: source.created_at ?? source.createdAt ?? null,
  };
}

function rowsReturningClause() {
  return `
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
       source_rows_truncated,
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
       idempotency_key,
       evaluated_at,
       created_at`;
}

function recordsMatch(existing = {}, record = {}) {
  return existing.idempotencyKey === record.idempotencyKey &&
    existing.policyId === record.policyId &&
    existing.intentId === record.intentId &&
    existing.libraryId === record.libraryId &&
    existing.acceptanceTransitionFingerprint === record.acceptanceTransitionFingerprint &&
    existing.verifierFingerprint === record.verifierFingerprint &&
    existing.verifierStatusId === record.verifierStatusId &&
    existing.sourceId === record.sourceId &&
    existing.sourceMediaType === record.sourceMediaType &&
    existing.sourceDeterministicOrderId === record.sourceDeterministicOrderId;
}

async function insertPolicyMigrationVerificationRun({ client, record }) {
  const result = await client.query(
    `INSERT INTO ${POLICY_MIGRATION_VERIFICATION_RUN_TABLE} (
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
       source_rows_truncated,
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
       idempotency_key,
       evaluated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
     )
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${rowsReturningClause()}`,
    [
      record.runVersion,
      record.policyId,
      record.intentId,
      record.libraryId,
      record.acceptanceTransitionFingerprint,
      record.sourceId,
      record.sourceMediaType,
      record.sourceDeterministicOrderId,
      record.sourceMaximumClassifications,
      record.sourceRowsRead,
      record.sourceRowsConsidered,
      record.sourceRepresentativeClassificationCount,
      record.sourceUnusableSourceRowCount,
      record.sourceRowsTruncated,
      record.sourceCoverageSufficient,
      record.sourceAuditOk,
      record.sourceAuditIssueCount,
      record.verifierStatusId,
      record.verifierFingerprint,
      record.verifierDifferenceCount,
      record.verifierEmittedDifferenceCount,
      record.verifierDifferencesTruncated,
      record.verifierAuditOk,
      record.verifierAuditIssueCount,
      record.coordinatorAuditOk,
      record.coordinatorAuditIssueCount,
      record.idempotencyKey,
      record.evaluatedAt,
    ],
  );

  return normalizeVerificationRunRow(firstRow(result));
}

async function findPolicyMigrationVerificationRun({ client, idempotencyKey }) {
  const result = await client.query(
    `SELECT ${rowsReturningClause()}
     FROM ${POLICY_MIGRATION_VERIFICATION_RUN_TABLE}
     WHERE idempotency_key = $1`,
    [idempotencyKey],
  );

  return normalizeVerificationRunRow(firstRow(result));
}

async function claimPolicyMigrationVerificationRun({ client, coordinatorResult } = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Migration verification-run claims require a caller-owned transaction client.');
  }

  const record = buildPolicyMigrationVerificationRunRecord(coordinatorResult);
  const insertedRun = await insertPolicyMigrationVerificationRun({ client, record });
  if (insertedRun.id) {
    return {
      statusId: 'claimed',
      claimed: true,
      replayed: false,
      conflicted: false,
      verificationRun: insertedRun,
    };
  }

  const existingRun = await findPolicyMigrationVerificationRun({
    client,
    idempotencyKey: record.idempotencyKey,
  });
  if (!existingRun.id) {
    throw new Error('Migration verification-run replay did not yield an existing record.');
  }

  return {
    statusId: recordsMatch(existingRun, record) ? 'replayed' : 'conflicted',
    claimed: false,
    replayed: recordsMatch(existingRun, record),
    conflicted: !recordsMatch(existingRun, record),
    verificationRun: existingRun,
  };
}

const policyMigrationVerificationRunRepository = Object.freeze({
  claim: claimPolicyMigrationVerificationRun,
  find: findPolicyMigrationVerificationRun,
  normalizeRow: normalizeVerificationRunRow,
});

export {
  POLICY_MIGRATION_VERIFICATION_RUN_TABLE,
  claimPolicyMigrationVerificationRun,
  findPolicyMigrationVerificationRun,
  normalizeVerificationRunRow,
  policyMigrationVerificationRunRepository,
};
