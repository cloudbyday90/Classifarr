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
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput,
} from '../../services/policyLibraryPolicyRebuild.mjs';
import {
  POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS,
  POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS,
  buildPolicyMigrationRepresentativeClassificationSourceAudit,
  createPolicyMigrationRepresentativeClassificationSource,
} from '../../services/policyMigrationRepresentativeClassificationSource.mjs';

function profileHandoff() {
  return {
    version: 'policy.library_profile_evidence_loader.v1',
    ok: true,
    statusId: 'ready',
    libraryId: 6,
    profileEvidence: {
      version: 'policy.library_profile_evidence.v1',
      libraryProfile: {
        identityCandidates: [],
        compatibilityCandidates: [{
          key: 'genre:animation',
          label: 'Animation',
          value: '80%',
          count: 8,
          confidence: 0.8,
          reasonCode: 'observed_library_distribution',
        }],
        outliers: [],
      },
      sideEffects: {
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
      },
    },
    profileEvidenceAudit: { ok: true },
    profileFreshness: {
      stale: false,
      updatedAt: '2026-06-30T12:00:00.000Z',
      reasonCode: 'current_profile_timestamp',
    },
    evidenceBoundary: { ok: true },
    evidenceBoundaryAudit: { ok: true },
    sideEffects: {
      libraryProfileRead: true,
      liveMediaServerLookupPerformed: false,
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      evidenceProjectionBuilt: true,
      policyStorageMutated: false,
    },
  };
}

function proposal() {
  return buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput({
    library: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      mediaType: 'movie',
    },
    profileHandoff: profileHandoff(),
    operatorIntent: {
      belongsHere: [{
        key: 'studio:disney',
        label: 'Disney',
        count: 7,
      }],
    },
    routingConfiguration: {
      configured: true,
      routeReady: true,
      targetName: 'Animated Movies',
      arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    },
  });
}

function persistedPolicyContext(overrides = {}) {
  return {
    policy_id: 44,
    library_id: 6,
    library_name: 'Animated Movies',
    media_type: 'movie',
    library_active: true,
    ...overrides,
  };
}

function createSource({ contextRows = [persistedPolicyContext()], classificationRows = [] } = {}) {
  const db = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: contextRows })
      .mockResolvedValueOnce({ rows: classificationRows }),
  };

  return {
    db,
    source: createPolicyMigrationRepresentativeClassificationSource({ db }),
  };
}

describe('policyMigrationRepresentativeClassificationSource', () => {
  test('collects bounded persisted destination outcomes with a parameterized, read-only scope', async () => {
    const { db, source } = createSource({
      classificationRows: [{
        id: 101,
        media_type: 'movie',
        library_id: 6,
        status: 'routed',
        confidence: 84,
        title: 'Raw title must not escape',
        metadata: { providerPayload: 'must not escape' },
      }, {
        id: 100,
        media_type: 'movie',
        library_id: 6,
        status: 'completed',
        confidence: 0.72,
      }],
    });

    const result = await source.collectRepresentativeClassifications({
      policyContext: { policyId: 44, libraryId: 6 },
      proposal: proposal(),
      maxClassifications: 2,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      ready: true,
      statusId: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.READY,
      policyContext: expect.objectContaining({
        policyId: 44,
        libraryId: 6,
        libraryName: 'Animated Movies',
        mediaType: 'movie',
      }),
      sourceProvenance: expect.objectContaining({
        sourceId: 'persisted_destination_library_final_outcomes',
        policyId: 44,
        libraryId: 6,
        mediaType: 'movie',
        deterministicOrderId: 'created_at_desc_id_desc',
      }),
      representativeClassifications: [
        expect.objectContaining({
          itemId: 101,
          mediaType: 'movie',
          legacyOutcome: expect.objectContaining({
            destinationLibraryId: 6,
            destinationLibraryName: 'Animated Movies',
            statusId: 'routed',
            routeReady: true,
            confidenceScore: 0.84,
          }),
          generatedIntentOutcome: expect.objectContaining({
            destinationLibraryId: 6,
            destinationLibraryName: 'Animated Movies',
          }),
        }),
        expect.objectContaining({
          itemId: 100,
          legacyOutcome: expect.objectContaining({
            statusId: 'completed',
            routeReady: false,
            confidenceScore: 0.72,
          }),
        }),
      ],
      sideEffects: {
        databaseRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
        classificationStorageMutated: false,
        routingWritten: false,
      },
    }));
    expect(JSON.stringify(result)).not.toContain('Raw title must not escape');
    expect(JSON.stringify(result)).not.toContain('must not escape');
    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM library_policies'), [
      44,
      6,
    ]);
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM classification_history classification'),
      [6, 'movie', expect.any(Array), 3],
    );
    expect(db.query.mock.calls[1][0]).toEqual(expect.not.stringContaining('Raw title'));
    expect(buildPolicyMigrationRepresentativeClassificationSourceAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('returns an explicit insufficient-coverage result when the destination has no usable history', async () => {
    const { source } = createSource();

    const result = await source.collectRepresentativeClassifications({
      policyContext: { policyId: 44, libraryId: 6 },
      proposal: proposal(),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      ready: false,
      statusId: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS
        .INSUFFICIENT_REPRESENTATIVE_COVERAGE,
      representativeClassifications: [],
      summary: expect.objectContaining({
        coverageSufficient: false,
        sourceRowsRead: 0,
        sourceRowsConsidered: 0,
        unusableSourceRowCount: 0,
      }),
    }));
    expect(buildPolicyMigrationRepresentativeClassificationSourceAudit(result).ok).toBe(true);
  });

  test('caps source reads and reports truncation without converting excluded rows to evidence', async () => {
    const { db, source } = createSource({
      classificationRows: [101, 100, 99].map(id => ({
        id,
        media_type: 'movie',
        library_id: 6,
        status: 'completed',
        confidence: 0.8,
      })),
    });

    const result = await source.collectRepresentativeClassifications({
      policyContext: { policyId: 44, libraryId: 6 },
      proposal: proposal(),
      maxClassifications: 2,
    });

    expect(result.representativeClassifications).toHaveLength(2);
    expect(result.summary).toEqual(expect.objectContaining({
      maximumClassifications: 2,
      sourceRowsRead: 3,
      sourceRowsConsidered: 2,
      representativeClassificationCount: 2,
      unusableSourceRowCount: 0,
      sourceRowsTruncated: true,
    }));
    expect(db.query).toHaveBeenNthCalledWith(2, expect.any(String), [
      6,
      'movie',
      expect.any(Array),
      3,
    ]);
  });

  test('fails closed before a history read when the request or persisted authority context is invalid', async () => {
    const { db, source } = createSource({
      contextRows: [persistedPolicyContext({ library_id: 7 })],
    });
    const invalidRequest = await source.collectRepresentativeClassifications({
      policyContext: { policyId: 'invalid', libraryId: 6 },
      proposal: proposal(),
    });
    const invalidProposal = await source.collectRepresentativeClassifications({
      policyContext: { policyId: 44, libraryId: 6 },
      proposal: {},
    });
    const mismatchedContext = await source.collectRepresentativeClassifications({
      policyContext: { policyId: 44, libraryId: 7 },
      proposal: proposal(),
    });

    expect(invalidRequest.statusId).toBe(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.INVALID_POLICY_CONTEXT
    );
    expect(invalidProposal.statusId).toBe(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.INVALID_REBUILD_PROPOSAL
    );
    expect(mismatchedContext.statusId).toBe(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.PROPOSAL_CONTEXT_MISMATCH
    );
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(buildPolicyMigrationRepresentativeClassificationSourceAudit(invalidRequest).ok).toBe(true);
    expect(buildPolicyMigrationRepresentativeClassificationSourceAudit(invalidProposal).ok).toBe(true);
    expect(buildPolicyMigrationRepresentativeClassificationSourceAudit(mismatchedContext).ok).toBe(true);
  });

  test('sanitizes unavailable context and database failures without copying errors', async () => {
    const unavailable = createSource({
      contextRows: [persistedPolicyContext({ library_active: false })],
    });
    const failingSource = createPolicyMigrationRepresentativeClassificationSource({
      db: { query: jest.fn().mockRejectedValue(new Error('database details must not escape')) },
    });

    const unavailableResult = await unavailable.source.collectRepresentativeClassifications({
      policyContext: { policyId: 44, libraryId: 6 },
      proposal: proposal(),
    });
    const failureResult = await failingSource.collectRepresentativeClassifications({
      policyContext: { policyId: 44, libraryId: 6 },
      proposal: proposal(),
    });

    expect(unavailableResult.statusId).toBe(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.POLICY_CONTEXT_UNAVAILABLE
    );
    expect(failureResult.statusId).toBe(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.COLLECTION_FAILED
    );
    expect(JSON.stringify(failureResult)).not.toContain('database details must not escape');
  });

  test('audit rejects raw data, a mismatched summary, and side effects', async () => {
    const { source } = createSource({
      classificationRows: [{
        id: 101,
        media_type: 'movie',
        library_id: 6,
        status: 'completed',
        confidence: 0.8,
      }],
    });
    const result = await source.collectRepresentativeClassifications({
      policyContext: { policyId: 44, libraryId: 6 },
      proposal: proposal(),
    });
    result.representativeClassifications[0].title = 'must not be admitted';
    result.summary.representativeClassificationCount = 99;
    result.sideEffects.policyStorageMutated = true;

    const audit = buildPolicyMigrationRepresentativeClassificationSourceAudit(result);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.RAW_DATA_EXPOSED,
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });
});
