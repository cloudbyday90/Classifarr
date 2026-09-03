/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCurrentInventorySemanticStudySnapshot,
} from '../../services/policyCandidateCurrentInventorySemanticStudySnapshot.mjs';
import {
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_DOCUMENT_VERSION,
  validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument,
} from '../../services/policyCandidateCurrentInventorySemanticStudySnapshotContract.mjs';
import {
  scorePolicyCandidateCurrentInventorySemanticStudySnapshot,
} from '../../services/policyCandidateCurrentInventorySemanticStudySnapshotScoring.mjs';

const contract = Object.freeze({
  valid: true,
  candidates: Object.freeze([
    Object.freeze({ libraryId: 10 }),
    Object.freeze({ libraryId: 20 }),
    Object.freeze({ libraryId: 30 }),
  ]),
});

describe('policyCandidateCurrentInventorySemanticStudySnapshot', () => {
  test('captures only leading and strongest-alternative relevance from policy-owned candidates', () => {
    const snapshot = buildPolicyCandidateCurrentInventorySemanticStudySnapshot({
      contract,
      fixtureId: 'fixture_0000000000000001',
      snapshotId: 'snapshot_0000000000000001',
      retrieval: {
        version: 'current_library.candidate_semantic_retrieval.v2',
        statusId: 'available',
        candidates: [
          { libraryId: 10, topRelevance: 58, items: [{ title: 'Do not retain this title' }] },
          { libraryId: 20, topRelevance: 89, items: [{ title: 'Nor this title' }] },
          { libraryId: 30, topRelevance: 91, items: [{ title: 'Or this title' }] },
          { libraryId: 99, topRelevance: 100, items: [{ title: 'Outside the contract' }] },
        ],
      },
    });

    expect(snapshot).toEqual({
      alternativeRelevance: 91,
      candidateCount: 3,
      fixtureId: 'fixture_0000000000000001',
      id: 'snapshot_0000000000000001',
      leadingRelevance: 58,
      retrievalStatusId: 'available',
      version: 'policy.candidate_current_inventory_semantic_study_snapshot.v1',
    });
    expect(JSON.stringify(snapshot)).not.toContain('title');
    expect(JSON.stringify(snapshot)).not.toContain('libraryId');
    expect(scorePolicyCandidateCurrentInventorySemanticStudySnapshot(snapshot))
      .toBe('supports_alternative_candidate');
  });

  test('records unavailable retrieval as an abstention without stale relevance', () => {
    const snapshot = buildPolicyCandidateCurrentInventorySemanticStudySnapshot({
      contract,
      fixtureId: 'fixture_0000000000000002',
      snapshotId: 'snapshot_0000000000000002',
      retrieval: {
        version: 'current_library.candidate_semantic_retrieval.v2',
        statusId: 'unavailable',
        candidates: [{ libraryId: 10, topRelevance: 99 }],
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      alternativeRelevance: null,
      leadingRelevance: null,
      retrievalStatusId: 'unavailable',
    }));
    expect(scorePolicyCandidateCurrentInventorySemanticStudySnapshot(snapshot)).toBe('abstain');
  });

  test('does not emit a caller-supplied content-bearing study identifier', () => {
    const snapshot = buildPolicyCandidateCurrentInventorySemanticStudySnapshot({
      contract,
      fixtureId: 'deep-water-2006',
      snapshotId: 'snapshot_0000000000000003',
      retrieval: {
        version: 'current_library.candidate_semantic_retrieval.v2',
        statusId: 'available',
        candidates: [{ libraryId: 10, topRelevance: 90 }, { libraryId: 20, topRelevance: 20 }],
      },
    });

    expect(snapshot).toBeNull();
  });

  test('rejects invalid current-inventory study documents and content-bearing fields', () => {
    const document = {
      retrievalProtocolVersion: 'current_library.candidate_semantic_retrieval.v2',
      snapshotSetId: 'snapshot_set_0000000000000001',
      snapshots: [{
        alternativeRelevance: 91,
        candidateCount: 2,
        fixtureId: 'fixture_0000000000000001',
        id: 'snapshot_0000000000000001',
        leadingRelevance: 58,
        retrievalStatusId: 'available',
        title: 'Must never be retained',
        version: 'policy.candidate_current_inventory_semantic_study_snapshot.v1',
      }],
      version: POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_DOCUMENT_VERSION,
    };

    const validation = validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument(document);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'unknown_field' }),
    ]));
  });
});
