/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function readyCoordinatorResult() {
  return {
    version: 'policy.migration_verification_coordinator.v1',
    statusId: 'ready',
    ok: true,
    evaluatedAt: '2026-07-29T14:00:00.000Z',
    policyContext: { policyId: 44, intentId: 101, libraryId: 6 },
    acceptanceTransition: { fingerprint: 'a'.repeat(64) },
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
      audit: { ok: true, issueCount: 0, issues: [] },
    },
    verification: {
      completed: true,
      canApplyReplacement: false,
      canDeleteLegacyPaths: false,
      verifier: {
        statusId: 'no_migration_differences',
        differenceSummary: { totalCount: 0, emittedCount: 0, truncated: false },
        audit: { ok: true, issueCount: 0, issues: [] },
      },
    },
    verifierReport: {
      statusId: 'no_migration_differences',
      sampleSetFingerprint: { fingerprint: 'b'.repeat(64) },
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

export {
  readyCoordinatorResult,
};
