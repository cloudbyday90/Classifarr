/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildHeldOutSemanticStudyBundle,
} from '../../services/heldOutSemanticStudyBundle.mjs';
import {
  buildHeldOutSemanticStudyEvaluationBundle,
} from '../../services/heldOutSemanticStudyEvaluationBundle.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationArtifact.mjs';
import {
  buildHeldOutSemanticStudyRetrievalRepresentationResults,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationResults.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS,
} from '../../services/policyCandidateSemanticEvaluationResultsSummaryContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
} from '../../services/policyCandidateSemanticReferenceSetContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from '../../services/policyCandidateSemanticSnapshotFingerprint.mjs';

function id(prefix, index) {
  return `${prefix}_${index.toString(16).padStart(16, '0')}`;
}

function selected() {
  return Array.from({ length: 24 }, (_, index) => ({
    fixtureId: id('fixture', index),
    snapshotId: id('snapshot', index),
    stratum: ['documentary', 'genre-overlap', 'ordinary', 'reality'][index % 4],
  }));
}

function snapshotDocument() {
  return {
    retrievalProtocolVersion: 'current_library.candidate_semantic_retrieval.v3',
    snapshotSetId: id('snapshot_set', 1),
    snapshots: selected().map((entry) => ({
      alternativeRelevance: 20,
      candidateCount: 2,
      fixtureId: entry.fixtureId,
      id: entry.snapshotId,
      leadingRelevance: 80,
      retrievalStatusId: 'available',
      version: 'policy.candidate_current_inventory_semantic_study_snapshot.v1',
    })),
    studyProvenance: {
      configurationFingerprint: `sha256:${'a'.repeat(64)}`,
      excludedIdentityCount: 24,
      exclusionSetFingerprint: `sha256:${'b'.repeat(64)}`,
      protocolVersion: 'policy.held_out_semantic_study.v1',
    },
    version: 'policy.candidate_current_inventory_semantic_study_snapshot_document.v2',
  };
}

function evaluationBundle() {
  const bundle = buildHeldOutSemanticStudyBundle({
    selected: selected(),
    snapshotDocument: snapshotDocument(),
  });
  return buildHeldOutSemanticStudyEvaluationBundle({
    bundle,
    packet: {
      cases: bundle.fixtureDocument.map((fixture) => ({
        fixtureId: fixture.id,
        media: { title: `Private title ${fixture.id}` },
      })),
      fixtureDocumentFingerprint: bundle.manifest.fixtureDocumentFingerprint,
      instructions: { boundary: 'Private review context.' },
      packetId: `review_packet_${'c'.repeat(64)}`,
      studyWindow: {
        expiresAt: '2026-09-11T12:00:00.000Z',
        startsAt: '2026-09-10T12:00:00.000Z',
      },
      version: 'policy.held_out_semantic_study_reviewer_packet.v1',
    },
  });
}

function referenceSetDocument(bundle) {
  return {
    fixtureDocumentFingerprint: bundle.manifest.fixtureDocumentFingerprint,
    labelingProtocolId: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS
      .INDEPENDENT_DOUBLE_BLIND_HUMAN,
    labels: bundle.fixtureDocument.map((fixture, index) => ({
      consensusStatusId: index === 0 ? 'adjudicated' : 'unanimous',
      fixtureId: fixture.id,
      referenceDecisionId: index % 3 === 0 ? 'review' : index % 3 === 1 ? 'admit' : 'abstain',
      reviewerCount: index === 0 ? 3 : 2,
    })),
    referenceSetId: 'retrieval-representation-reference-set',
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  };
}

function representationArtifact(bundle) {
  const decisionsByRepresentation = {
    declared_library_purpose: 'admit',
    media_description: 'review',
    nearest_item_history: 'abstain',
  };
  return {
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(bundle.fixtureDocument),
    representationResults: Object.values(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS)
      .map((representationId) => ({
        representationId,
        signals: bundle.fixtureDocument.map((fixture) => ({
          decisionId: decisionsByRepresentation[representationId],
          fixtureId: fixture.id,
        })),
      })),
    snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(bundle.snapshotDocument),
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION,
  };
}

describe('held-out retrieval-representation results', () => {
  test('compares the three pinned categorical representations against the same independent labels', () => {
    const bundle = evaluationBundle();
    const result = buildHeldOutSemanticStudyRetrievalRepresentationResults({
      evaluationBundle: bundle,
      referenceSetDocument: referenceSetDocument(bundle),
      representationArtifact: representationArtifact(bundle),
    });

    expect(result.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.SUMMARY_AVAILABLE,
    );
    expect(result.report.comparisons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        representationId: 'media_description',
        comparison: expect.objectContaining({ evaluatedFixtureCount: 24 }),
        coverageByStratum: expect.any(Array),
      }),
      expect.objectContaining({ representationId: 'declared_library_purpose' }),
      expect.objectContaining({ representationId: 'nearest_item_history' }),
    ]));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Private title');
    expect(serialized).not.toContain('fixture_0000000000000000');
    expect(serialized).not.toContain('fixtureDocumentFingerprint');
  });

  test.each(['an unbound artifact', 'a non-independent reference set'])(
    'does not produce an available result for %s',
    (kind) => {
      const bundle = evaluationBundle();
      const artifact = representationArtifact(bundle);
      const referenceSet = referenceSetDocument(bundle);
      if (kind === 'an unbound artifact') artifact.snapshotDocumentFingerprint = `sha256:${'0'.repeat(64)}`;
      if (kind === 'a non-independent reference set') {
        referenceSet.labelingProtocolId = POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS
          .SYNTHETIC_EXAMPLE;
      }
      const result = buildHeldOutSemanticStudyRetrievalRepresentationResults({
        evaluationBundle: bundle,
        referenceSetDocument: referenceSet,
        representationArtifact: artifact,
      });

      expect(result.report).toBeNull();
      expect(result.status.id).toBe(kind === 'an unbound artifact'
        ? POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.EVALUATION_SOURCE_INVALID
        : POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS
          .INDEPENDENT_REFERENCE_SET_REQUIRED);
    },
  );
});
