/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
} from '../../services/policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from '../../services/policyCandidateSemanticSnapshotFingerprint.mjs';
import {
  buildPolicyCandidateSemanticEvaluationResultsSummary,
} from '../../services/policyCandidateSemanticEvaluationResultsSummary.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS,
} from '../../services/policyCandidateSemanticEvaluationResultsSummaryContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
} from '../../services/policyCandidateSemanticReferenceSetContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION,
} from '../../services/policyCandidateSemanticSnapshotOfflineEvaluation.mjs';

function buildFixture(index, { referenceDecisionId, tagId }) {
  return {
    id: `summary-${index}`,
    name: `Semantic evaluation fixture ${index}`,
    observations: {
      candidateSetSelectionStatusId: 'confirmed_candidate',
      contrastiveStatusId: 'leading_identity_match',
      semanticRetrievalSignalId: 'supports_leading_candidate',
      semanticSnapshotId: `snapshot-summary-${index}`,
    },
    reference: { decisionId: referenceDecisionId },
    tags: [tagId],
    version: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
  };
}

function buildFixtureDocument() {
  return [
    buildFixture(0, { referenceDecisionId: 'review', tagId: 'documentary' }),
    buildFixture(1, { referenceDecisionId: 'review', tagId: 'documentary' }),
    buildFixture(2, { referenceDecisionId: 'review', tagId: 'genre-overlap' }),
    buildFixture(3, { referenceDecisionId: 'review', tagId: 'genre-overlap' }),
    buildFixture(4, { referenceDecisionId: 'admit', tagId: 'ordinary' }),
    buildFixture(5, { referenceDecisionId: 'admit', tagId: 'ordinary' }),
    buildFixture(6, { referenceDecisionId: 'admit', tagId: 'reality' }),
    buildFixture(7, { referenceDecisionId: 'admit', tagId: 'reality' }),
  ];
}

function buildReferenceSetDocument(fixtureDocument) {
  return {
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
    labelingProtocolId: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS
      .INDEPENDENT_DOUBLE_BLIND_HUMAN,
    labels: fixtureDocument.map((fixture, index) => ({
      consensusStatusId: index === 0 ? 'adjudicated' : 'unanimous',
      fixtureId: fixture.id,
      referenceDecisionId: fixture.reference.decisionId,
      reviewerCount: index === 0 ? 3 : 2,
    })),
    referenceSetId: 'semantic-evaluation-reference-set',
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  };
}

function buildSnapshotReport(fixtureDocument) {
  const semanticDecisions = ['review', 'review', 'review', 'admit', 'admit', 'admit', 'abstain', 'review'];
  return {
    authority: {
      automaticActions: {
        aiInvocation: false,
        learning: false,
        policyChange: false,
        retry: false,
        routing: false,
      },
      operatorWorkflowAdmission: false,
      scope: 'offline_evaluation_only',
      snapshotAccess: 'validated_fixed_input_read_only',
    },
    evaluation: {
      results: fixtureDocument.map((fixture, index) => ({
        fixtureId: fixture.id,
        referenceDecisionId: fixture.reference.decisionId,
        signalDecisions: { semantic_retrieval_proposal: semanticDecisions[index] },
      })),
      validation: { ok: true },
    },
    semanticSnapshot: {
      provenance: {
        fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
      },
      validation: {
        binding: { issueCount: 0, ok: true },
        fixture: { issueCount: 0, ok: true },
        manifest: { issueCount: 0, ok: true },
        semanticSnapshot: { issueCount: 0, ok: true },
      },
    },
    version: POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION,
  };
}

describe('policyCandidateSemanticEvaluationResultsSummary', () => {
  test('summarizes independent, fixed evaluation outcomes by stratum with Wilson uncertainty', () => {
    const fixtureDocument = buildFixtureDocument();
    const result = buildPolicyCandidateSemanticEvaluationResultsSummary({
      fixtureDocument,
      referenceSetDocument: buildReferenceSetDocument(fixtureDocument),
      snapshotReport: buildSnapshotReport(fixtureDocument),
    });

    expect(result.status).toEqual({
      automaticRoutingEligibility: false,
      id: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.SUMMARY_AVAILABLE,
      policyChangeEligibility: false,
    });
    expect(result.authority).toEqual(expect.objectContaining({
      operatorWorkflowAdmission: false,
      scope: 'offline_evaluation_results_summary_only',
    }));
    expect(result.report).toEqual(expect.objectContaining({
      calibration: {
        available: false,
        reasonId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS
          .SCORELESS_CATEGORICAL_SIGNAL,
      },
      comparison: expect.objectContaining({
        disagreementCount: 3,
        evaluatedFixtureCount: 8,
        decisionAgreement: expect.objectContaining({
          numeratorCount: 5,
          denominatorCount: 8,
          ratePercent: 62.5,
          confidenceInterval: expect.objectContaining({
            confidenceLevelPercent: 95,
            methodId: 'wilson_score',
          }),
        }),
      }),
      referenceReview: expect.objectContaining({
        adjudicatedFixtureCount: 1,
        unanimousFixtureCount: 7,
      }),
    }));
    expect(result.report.coverageByStratum).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stratumId: 'documentary',
        fixtureCount: 2,
        comparison: expect.objectContaining({ disagreementCount: 0 }),
      }),
      expect.objectContaining({
        stratumId: 'reality',
        fixtureCount: 2,
        comparison: expect.objectContaining({ disagreementCount: 2 }),
      }),
    ]));
    expect(JSON.stringify(result)).not.toContain('Semantic evaluation fixture');
    expect(JSON.stringify(result)).not.toContain('summary-0');
    expect(JSON.stringify(result)).not.toContain('fixtureDocumentFingerprint');
  });

  test('does not summarize a scoreless snapshot without independent labels', () => {
    const fixtureDocument = buildFixtureDocument();
    const result = buildPolicyCandidateSemanticEvaluationResultsSummary({
      fixtureDocument,
      snapshotReport: buildSnapshotReport(fixtureDocument),
    });

    expect(result.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS
        .INDEPENDENT_REFERENCE_SET_REQUIRED,
    );
    expect(result.report).toBeNull();
  });

  test('fails closed when the semantic evaluation source is not fingerprint-bound', () => {
    const fixtureDocument = buildFixtureDocument();
    const snapshotReport = buildSnapshotReport(fixtureDocument);
    snapshotReport.semanticSnapshot.provenance.fixtureDocumentFingerprint = `sha256:${'0'.repeat(64)}`;

    const result = buildPolicyCandidateSemanticEvaluationResultsSummary({
      fixtureDocument,
      referenceSetDocument: buildReferenceSetDocument(fixtureDocument),
      snapshotReport,
    });

    expect(result.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.EVALUATION_SOURCE_INVALID,
    );
    expect(result.report).toBeNull();
  });
});
