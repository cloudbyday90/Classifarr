/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateSemanticSnapshotSignals,
} from '../../services/policyCandidateSemanticSnapshotAdapter.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from '../../services/policyCandidateSemanticSnapshotFingerprint.mjs';

function fixture({ id, semanticSnapshotId }) {
  return {
    id,
    name: `Redacted ${id}`,
    observations: {
      candidateSetSelectionStatusId: 'changed_outside_candidates',
      contrastiveStatusId: 'alternative_identity_match',
      semanticRetrievalSignalId: 'supports_alternative_candidate',
      semanticSnapshotId,
    },
    reference: { decisionId: 'review' },
    tags: ['broad-policy'],
    version: 'policy.candidate_evidence_offline_evaluation_fixture.v1',
  };
}

describe('policyCandidateCurrentInventorySemanticStudySnapshot adapter', () => {
  test('adapts a bound current-inventory relevance study without exposing its scores', () => {
    const fixtureDocument = [fixture({
      id: 'fixture_0000000000000001',
      semanticSnapshotId: 'snapshot_0000000000000001',
    })];
    const snapshotDocument = {
      retrievalProtocolVersion: 'current_library.candidate_semantic_retrieval.v2',
      snapshotSetId: 'snapshot_set_0000000000000001',
      snapshots: [{
        alternativeRelevance: 92,
        candidateCount: 2,
        fixtureId: 'fixture_0000000000000001',
        id: 'snapshot_0000000000000001',
        leadingRelevance: 52,
        retrievalStatusId: 'available',
        version: 'policy.candidate_current_inventory_semantic_study_snapshot.v1',
      }],
      version: 'policy.candidate_current_inventory_semantic_study_snapshot_document.v1',
    };
    const manifest = {
      fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
      snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument),
      version: 'policy.candidate_semantic_snapshot_manifest.v1',
    };

    const result = buildPolicyCandidateSemanticSnapshotSignals({
      fixtureDocument,
      manifest,
      snapshotDocument,
    });

    expect(result).toMatchObject({
      ok: true,
      provenance: {
        sourceId: 'current_inventory_relevance',
        retrievalProtocolVersion: 'current_library.candidate_semantic_retrieval.v2',
      },
      signals: [{
        fixtureId: 'fixture_0000000000000001',
        semanticRetrievalSignalId: 'supports_alternative_candidate',
      }],
    });
    expect(JSON.stringify(result)).not.toContain('leadingRelevance');
    expect(JSON.stringify(result)).not.toContain('alternativeRelevance');
  });
});
