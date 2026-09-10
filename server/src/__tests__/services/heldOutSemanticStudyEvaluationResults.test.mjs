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
  buildHeldOutSemanticStudyEvaluationResults,
} from '../../services/heldOutSemanticStudyEvaluationResults.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS,
} from '../../services/policyCandidateSemanticEvaluationResultsSummaryContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
} from '../../services/policyCandidateSemanticReferenceSetContract.mjs';

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
  const packet = {
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
  };
  return buildHeldOutSemanticStudyEvaluationBundle({ bundle, packet });
}

function referenceSetDocument(bundle) {
  return {
    fixtureDocumentFingerprint: bundle.manifest.fixtureDocumentFingerprint,
    labelingProtocolId: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS
      .INDEPENDENT_DOUBLE_BLIND_HUMAN,
    labels: bundle.fixtureDocument.map((fixture) => ({
      consensusStatusId: 'unanimous',
      fixtureId: fixture.id,
      referenceDecisionId: fixture.reference.decisionId,
      reviewerCount: 2,
    })),
    referenceSetId: 'held_out_reference_set',
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  };
}

describe('held-out semantic-study evaluation results', () => {
  test('returns the existing aggregate-only report from exact redacted artifacts', () => {
    const bundle = evaluationBundle();
    const result = buildHeldOutSemanticStudyEvaluationResults({
      evaluationBundle: bundle,
      referenceSetDocument: referenceSetDocument(bundle),
    });

    expect(result.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.SUMMARY_AVAILABLE,
    );
    expect(result.report).toEqual(expect.objectContaining({
      comparison: expect.objectContaining({ evaluatedFixtureCount: 24 }),
      coverageByStratum: expect.any(Array),
    }));
    expect(JSON.stringify(result)).not.toContain('Private title');
    expect(JSON.stringify(result)).not.toContain('fixture_0000000000000000');
  });

  test.each(['wrong version', 'unknown field', 'tampered snapshot'])(
    'fails closed for a %s bundle',
    (kind) => {
      const bundle = evaluationBundle();
      const altered = structuredClone(bundle);
      if (kind === 'wrong version') altered.version = 'unsupported';
      if (kind === 'unknown field') altered.untrusted = true;
      if (kind === 'tampered snapshot') altered.snapshotDocument.snapshots[0].id = 'altered_snapshot';

      const result = buildHeldOutSemanticStudyEvaluationResults({
        evaluationBundle: altered,
        referenceSetDocument: referenceSetDocument(bundle),
      });

      expect(result.status.id).toBe(
        POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.EVALUATION_SOURCE_INVALID,
      );
      expect(result.report).toBeNull();
    },
  );

  test('does not write a report conceptually until independent labels exist', () => {
    const bundle = evaluationBundle();
    const result = buildHeldOutSemanticStudyEvaluationResults({ evaluationBundle: bundle });

    expect(result.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS
        .INDEPENDENT_REFERENCE_SET_REQUIRED,
    );
    expect(result.report).toBeNull();
  });
});
