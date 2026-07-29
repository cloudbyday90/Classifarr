/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  claimPolicyMigrationVerificationRun,
} from '../../services/policyMigrationVerificationRunRepository.mjs';
import {
  buildPolicyMigrationVerificationRunRecord,
} from '../../services/policyMigrationVerificationRunContract.mjs';
import {
  readyCoordinatorResult,
} from '../helpers/policyMigrationVerificationRunFixture.mjs';

function rowFromRecord(record, overrides = {}) {
  return {
    id: 700,
    run_version: record.runVersion,
    policy_id: record.policyId,
    intent_id: record.intentId,
    library_id: record.libraryId,
    acceptance_transition_fingerprint: record.acceptanceTransitionFingerprint,
    source_id: record.sourceId,
    source_media_type: record.sourceMediaType,
    source_deterministic_order_id: record.sourceDeterministicOrderId,
    source_maximum_classifications: record.sourceMaximumClassifications,
    source_rows_read: record.sourceRowsRead,
    source_rows_considered: record.sourceRowsConsidered,
    source_representative_classification_count: record.sourceRepresentativeClassificationCount,
    source_unusable_source_row_count: record.sourceUnusableSourceRowCount,
    source_rows_truncated: record.sourceRowsTruncated,
    source_coverage_sufficient: record.sourceCoverageSufficient,
    source_audit_ok: record.sourceAuditOk,
    source_audit_issue_count: record.sourceAuditIssueCount,
    verifier_status_id: record.verifierStatusId,
    verifier_fingerprint: record.verifierFingerprint,
    verifier_difference_count: record.verifierDifferenceCount,
    verifier_emitted_difference_count: record.verifierEmittedDifferenceCount,
    verifier_differences_truncated: record.verifierDifferencesTruncated,
    verifier_audit_ok: record.verifierAuditOk,
    verifier_audit_issue_count: record.verifierAuditIssueCount,
    coordinator_audit_ok: record.coordinatorAuditOk,
    coordinator_audit_issue_count: record.coordinatorAuditIssueCount,
    idempotency_key: record.idempotencyKey,
    evaluated_at: record.evaluatedAt,
    created_at: '2026-07-29T14:00:01.000Z',
    ...overrides,
  };
}

describe('policyMigrationVerificationRunRepository', () => {
  test('claims one bounded verification receipt with PostgreSQL conflict protection', async () => {
    const record = buildPolicyMigrationVerificationRunRecord(readyCoordinatorResult());
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [rowFromRecord(record)] }),
    };

    const result = await claimPolicyMigrationVerificationRun({
      client,
      coordinatorResult: readyCoordinatorResult(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'claimed',
      claimed: true,
      replayed: false,
      conflicted: false,
      verificationRun: expect.objectContaining({
        id: 700,
        verifierFingerprint: record.verifierFingerprint,
      }),
    }));
    expect(client.query.mock.calls[0][0]).toContain(
      'INSERT INTO policy_migration_verification_runs'
    );
    expect(client.query.mock.calls[0][0]).toContain('ON CONFLICT (idempotency_key) DO NOTHING');
    expect(JSON.stringify(client.query.mock.calls[0][1])).not.toContain('must not persist');
  });

  test('returns a matching durable receipt on a replay without writing another row', async () => {
    const record = buildPolicyMigrationVerificationRunRecord(readyCoordinatorResult());
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [rowFromRecord(record)] }),
    };

    const result = await claimPolicyMigrationVerificationRun({
      client,
      coordinatorResult: readyCoordinatorResult(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'replayed',
      claimed: false,
      replayed: true,
      conflicted: false,
    }));
    expect(client.query.mock.calls[1][0]).toContain(
      'FROM policy_migration_verification_runs'
    );
  });

  test('surfaces a collision as conflicted instead of treating it as a replay', async () => {
    const record = buildPolicyMigrationVerificationRunRecord(readyCoordinatorResult());
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [rowFromRecord(record, { verifier_fingerprint: 'c'.repeat(64) })],
        }),
    };

    const result = await claimPolicyMigrationVerificationRun({
      client,
      coordinatorResult: readyCoordinatorResult(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'conflicted',
      claimed: false,
      replayed: false,
      conflicted: true,
    }));
  });
});
