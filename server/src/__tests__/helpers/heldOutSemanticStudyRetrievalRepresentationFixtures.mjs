/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildHeldOutSemanticStudyBundle,
} from '../../services/heldOutSemanticStudyBundle.mjs';
import {
  buildHeldOutSemanticStudyEvaluationBundle,
} from '../../services/heldOutSemanticStudyEvaluationBundle.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
} from '../../services/policyCandidateSemanticReferenceSetContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from '../../services/policyCandidateSemanticSnapshotFingerprint.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_VERSION,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationSubmission.mjs';

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

export function createRetrievalRepresentationEvaluationBundle() {
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

export function createRetrievalRepresentationSubmission(bundle) {
  return {
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(bundle.fixtureDocument),
    signals: bundle.fixtureDocument.map((fixture, index) => ({
      declaredLibraryPurposeDecisionId: index % 3 === 0 ? 'review' : 'admit',
      fixtureId: fixture.id,
      mediaDescriptionDecisionId: index % 3 === 1 ? 'review' : 'admit',
      nearestItemHistoryClassificationLabelExcludedDecisionId: 'abstain',
      nearestItemHistoryClassificationLabelIncludedDecisionId: 'review',
    })),
    snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(bundle.snapshotDocument),
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_VERSION,
  };
}

export function createRetrievalRepresentationReferenceSet(bundle) {
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
