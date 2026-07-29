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
  POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS,
  buildPolicyMigrationVerificationRunAudit,
  buildPolicyMigrationVerificationRunRecord,
  buildPolicyMigrationVerificationRunResult,
  validateCoordinatorForPersistence,
} from '../../services/policyMigrationVerificationRunContract.mjs';

const FINGERPRINTS = Object.freeze({
  transition: 'a'.repeat(64),
  verifier: 'b'.repeat(64),
});

function readyCoordinatorResult() {
  return {
    version: 'policy.migration_verification_coordinator.v1',
    statusId: 'ready',
    ok: true,
    evaluatedAt: '2026-07-29T14:00:00.000Z',
    policyContext: {
      policyId: 44,
      intentId: 101,
      libraryId: 6,
    },
    acceptanceTransition: {
      fingerprint: FINGERPRINTS.transition,
    },
    source: {
      statusId: 'ready',
      ready: true,
      summary: {
        maximumClassifications: 25,
        sourceRowsRead: 2,
        sourceRowsConsidered: 2,
        representativeClassificationCount: 2,
        unusableSourceRowCount: 0,
        sourceRowsTruncated: false,
        coverageSufficient: true,
      },
      provenance: {
        sourceId: 'persisted_destination_library_final_outcomes',
        policyId: 44,
        libraryId: 6,
        mediaType: 'movie',
        deterministicOrderId: 'created_at_desc_id_desc',
      },
      audit: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    },
    verification: {
      completed: true,
      canApplyReplacement: false,
      canDeleteLegacyPaths: false,
      verifier: {
        statusId: 'no_migration_differences',
        differenceSummary: {
          totalCount: 0,
          emittedCount: 0,
          truncated: false,
        },
        audit: {
          ok: true,
          issueCount: 0,
          issues: [],
        },
      },
    },
    verifierReport: {
      statusId: 'no_migration_differences',
      sampleSetFingerprint: {
        fingerprint: FINGERPRINTS.verifier,
      },
      differences: [{ itemId: 901, title: 'must not persist' }],
    },
    normalWorkflowSurface: false,
    issueCount: 0,
    issues: [],
    sideEffects: {
      databaseRead: true,
      policyStorageMutated: false,
      classificationStorageMutated: false,
      routingWritten: false,
      rollbackCreated: false,
      liveMediaServerLookupPerformed: false,
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
    },
  };
}

describe('policyMigrationVerificationRunContract', () => {
  test('reduces a ready coordinator result to bounded replay-protected persistence fields', () => {
    const coordinatorResult = readyCoordinatorResult();
    const record = buildPolicyMigrationVerificationRunRecord(coordinatorResult);

    expect(record).toEqual(expect.objectContaining({
      runVersion: 1,
      policyId: 44,
      intentId: 101,
      libraryId: 6,
      acceptanceTransitionFingerprint: FINGERPRINTS.transition,
      sourceId: 'persisted_destination_library_final_outcomes',
      verifierStatusId: 'no_migration_differences',
      verifierFingerprint: FINGERPRINTS.verifier,
      coordinatorAuditOk: true,
      idempotencyKey: expect.stringMatching(/^policy:migration_verification:[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(record)).not.toContain('must not persist');
    expect(JSON.stringify(record)).not.toContain('itemId');
  });

  test('rejects unsafe coordinator output before any persistence record can be built', () => {
    const coordinatorResult = readyCoordinatorResult();
    coordinatorResult.representativeClassifications = [{ title: 'raw sample' }];

    const validation = validateCoordinatorForPersistence(coordinatorResult);

    expect(validation.ok).toBe(false);
    expect(() => buildPolicyMigrationVerificationRunRecord(coordinatorResult)).toThrow(
      'Migration verification runs require a ready, audited coordinator result.'
    );
  });

  test('keeps a persisted handoff receipt bounded and directs the next snapshot-gate binding', () => {
    const record = buildPolicyMigrationVerificationRunRecord(readyCoordinatorResult());
    const result = buildPolicyMigrationVerificationRunResult({
      statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED,
      coordinatorResult: readyCoordinatorResult(),
      verificationRun: record,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      persisted: true,
      replayed: false,
      normalWorkflowSurface: false,
      sideEffects: expect.objectContaining({
        snapshotCreated: false,
        policyReplaced: false,
        policyDeleted: false,
        routingWritten: false,
        browserControlsRendered: false,
      }),
    }));
    expect(JSON.stringify(result)).not.toContain('must not persist');
    expect(buildPolicyMigrationVerificationRunAudit(result)).toEqual(expect.objectContaining({
      ok: true,
      nextStep: expect.objectContaining({
        stepId: 'library_rebuild_snapshot_gate_verification_binding',
      }),
    }));
  });
});

export {
  readyCoordinatorResult,
};
