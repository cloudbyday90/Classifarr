/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS,
  validateHeldOutSemanticStudyRetrievalRepresentationArtifact,
  validateHeldOutSemanticStudyRetrievalRepresentationArtifactBinding,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationArtifact.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from '../../services/policyCandidateSemanticSnapshotFingerprint.mjs';

function fixtureDocument() {
  return [{
    id: 'fixture_0000000000000000',
    name: 'Private fixture name',
    observations: {
      candidateSetSelectionStatusId: 'routed_not_applicable',
      contrastiveStatusId: 'not_applicable',
      semanticRetrievalSignalId: 'abstain',
      semanticSnapshotId: 'snapshot_0000000000000000',
    },
    reference: { decisionId: 'abstain' },
    tags: ['ordinary'],
    version: 'policy.candidate_evidence_offline_evaluation_fixture.v1',
  }];
}

function artifact({ fixture = fixtureDocument(), snapshot = { version: 'fixed' } } = {}) {
  return {
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixture),
    representationResults: Object.values(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS)
      .map((representationId) => ({
        representationId,
        signals: [{ decisionId: 'abstain', fixtureId: fixture[0].id }],
      })),
    snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(snapshot),
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION,
  };
}

describe('held-out retrieval-representation study artifact', () => {
  test('accepts only three status-only representation results bound to opaque fixtures', () => {
    const fixture = fixtureDocument();
    const snapshot = { version: 'fixed' };
    const document = artifact({ fixture, snapshot });

    expect(validateHeldOutSemanticStudyRetrievalRepresentationArtifact(document)).toEqual(
      expect.objectContaining({ ok: true, representationCount: 3 }),
    );
    expect(validateHeldOutSemanticStudyRetrievalRepresentationArtifactBinding({
      artifact: document,
      fixtureDocument: fixture,
      snapshotDocument: snapshot,
    })).toEqual(expect.objectContaining({ ok: true }));
  });

  test.each([
    ['a raw description', (document) => { document.representationResults[0].description = 'Private media text'; }],
    ['a missing variant', (document) => { document.representationResults.pop(); }],
    ['a duplicate fixture', (document) => {
      document.representationResults[0].signals.push({
        decisionId: 'review',
        fixtureId: document.representationResults[0].signals[0].fixtureId,
      });
    }],
  ])('rejects %s', (_label, alter) => {
    const document = artifact();
    alter(document);

    expect(validateHeldOutSemanticStudyRetrievalRepresentationArtifact(document)).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  test('fails closed when a valid artifact is pinned to a different snapshot', () => {
    const fixture = fixtureDocument();
    const document = artifact({ fixture, snapshot: { version: 'original' } });
    const validation = validateHeldOutSemanticStudyRetrievalRepresentationArtifactBinding({
      artifact: document,
      fixtureDocument: fixture,
      snapshotDocument: { version: 'substituted' },
    });

    expect(validation).toEqual(expect.objectContaining({ ok: false }));
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS
          .SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH,
      }),
    ]));
  });
});
