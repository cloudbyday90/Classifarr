/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
} from '../../services/policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  evaluatePolicyCandidateSemanticCounterEvidenceReadiness,
} from '../../services/policyCandidateSemanticCounterEvidenceReadiness.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS,
} from '../../services/policyCandidateSemanticCounterEvidenceReadinessContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
} from '../../services/policyCandidateSemanticReferenceSetContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from '../../services/policyCandidateSemanticSnapshotFingerprint.mjs';
import {
  evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument,
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION,
} from '../../services/policyCandidateSemanticSnapshotOfflineEvaluation.mjs';

const FIXTURE_DOCUMENT_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-evidence-offline-evaluation.fixtures.json',
  import.meta.url,
);
const SNAPSHOT_DOCUMENT_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-evidence-offline-semantic-snapshots.json',
  import.meta.url,
);
const MANIFEST_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-evidence-offline-semantic-snapshot.manifest.json',
  import.meta.url,
);

function buildFixture(index, referenceDecisionId) {
  const id = `counter-evidence-${index}`;
  const supportsAlternative = referenceDecisionId === 'review';
  return {
    id,
    name: `Counter-evidence fixture ${index}`,
    observations: {
      candidateSetSelectionStatusId: 'confirmed_candidate',
      contrastiveStatusId: 'leading_identity_match',
      semanticRetrievalSignalId: supportsAlternative
        ? 'supports_alternative_candidate'
        : 'supports_leading_candidate',
      semanticSnapshotId: `snapshot-${id}`,
    },
    reference: { decisionId: referenceDecisionId },
    tags: ['broad-policy', 'documentary', 'genre-overlap', 'reality'],
    version: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
  };
}

function buildTrustedSnapshotReport(fixtureDocument) {
  const fixtureDocumentFingerprint = createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument);
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
      snapshotAccess: 'committed_read_only',
    },
    evaluation: {
      results: fixtureDocument.map((fixture) => ({
        fixtureId: fixture.id,
        referenceDecisionId: fixture.reference.decisionId,
        signalDecisions: {
          semantic_retrieval_proposal: fixture.observations.semanticRetrievalSignalId ===
            'supports_alternative_candidate'
            ? 'review'
            : 'admit',
        },
      })),
      validation: { ok: true },
    },
    semanticSnapshot: {
      provenance: { fixtureDocumentFingerprint },
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

function buildIndependentReferenceSetDocument(fixtureDocument) {
  return {
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
    labelingProtocolId: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS
      .INDEPENDENT_DOUBLE_BLIND_HUMAN,
    labels: fixtureDocument.map((fixture) => ({
      consensusStatusId: 'unanimous',
      fixtureId: fixture.id,
      referenceDecisionId: fixture.reference.decisionId,
      reviewerCount: 2,
    })),
    referenceSetId: 'independent-reference-set',
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  };
}

async function loadPinnedSnapshotReport() {
  const [fixtureSource, snapshotSource, manifestSource] = await Promise.all([
    readFile(FIXTURE_DOCUMENT_URL, 'utf8'),
    readFile(SNAPSHOT_DOCUMENT_URL, 'utf8'),
    readFile(MANIFEST_URL, 'utf8'),
  ]);
  const fixtureDocument = JSON.parse(fixtureSource);
  return {
    fixtureDocument,
    snapshotReport: evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
      fixtureDocument,
      manifest: JSON.parse(manifestSource),
      snapshotDocument: JSON.parse(snapshotSource),
    }),
  };
}

describe('policyCandidateSemanticCounterEvidenceReadiness', () => {
  test('reports the current pinned corpus as not ready without changing route authority', async () => {
    const report = evaluatePolicyCandidateSemanticCounterEvidenceReadiness(await loadPinnedSnapshotReport());

    expect(report.status).toEqual({
      automaticRoutingEligibility: false,
      id: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS.NOT_READY,
      policyChangeEligibility: false,
    });
    expect(report.baseline).toEqual(expect.objectContaining({
      evaluatedFixtureCount: 8,
      falsePositiveCount: 1,
      precisionPercent: 66.7,
      recallPercent: 50,
    }));
    expect(report.blockers).toEqual(expect.arrayContaining([
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.FALSE_POSITIVE_PRESENT,
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS
        .INDEPENDENT_REFERENCE_SET_UNAVAILABLE,
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.INSUFFICIENT_FIXTURE_COUNT,
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.INSUFFICIENT_STRATUM_COVERAGE,
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.RECALL_BELOW_MINIMUM,
    ]));
    expect(JSON.stringify(report)).not.toContain('queryEmbedding');
    expect(JSON.stringify(report)).not.toContain('candidateEmbeddings');
  });

  test('only reaches human-review readiness for a bound, representative, error-free corpus', () => {
    const fixtureDocument = [
      ...Array.from({ length: 12 }, (_, index) => buildFixture(index, 'review')),
      ...Array.from({ length: 12 }, (_, index) => buildFixture(index + 12, 'admit')),
    ];

    const report = evaluatePolicyCandidateSemanticCounterEvidenceReadiness({
      fixtureDocument,
      referenceSetDocument: buildIndependentReferenceSetDocument(fixtureDocument),
      snapshotReport: buildTrustedSnapshotReport(fixtureDocument),
    });

    expect(report.status).toEqual({
      automaticRoutingEligibility: false,
      id: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS.READY_FOR_HUMAN_REVIEW,
      policyChangeEligibility: false,
    });
    expect(report.blockers).toEqual([]);
    expect(report.baseline).toEqual(expect.objectContaining({
      falseNegativeCount: 0,
      falsePositiveCount: 0,
      precisionPercent: 100,
      recallPercent: 100,
    }));
  });

  test('uses independent labels as the evaluation oracle instead of copied fixture labels', () => {
    const fixtureDocument = [
      ...Array.from({ length: 12 }, (_, index) => buildFixture(index, 'review')),
      ...Array.from({ length: 12 }, (_, index) => buildFixture(index + 12, 'admit')),
    ];
    const referenceSetDocument = buildIndependentReferenceSetDocument(fixtureDocument);
    for (const label of referenceSetDocument.labels) label.referenceDecisionId = 'admit';

    const report = evaluatePolicyCandidateSemanticCounterEvidenceReadiness({
      fixtureDocument,
      referenceSetDocument,
      snapshotReport: buildTrustedSnapshotReport(fixtureDocument),
    });

    expect(report.status.id).toBe(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS.NOT_READY);
    expect(report.baseline).toEqual(expect.objectContaining({
      falsePositiveCount: 12,
      referenceReviewCount: 0,
    }));
    expect(report.blockers).toEqual(expect.arrayContaining([
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.FALSE_POSITIVE_PRESENT,
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS
        .INSUFFICIENT_REFERENCE_REVIEW_COUNT,
    ]));
  });

  test('fails closed when the snapshot report is not bound to the reviewed fixture document', () => {
    const fixtureDocument = [buildFixture(1, 'review')];
    const snapshotReport = buildTrustedSnapshotReport(fixtureDocument);
    snapshotReport.semanticSnapshot.provenance.fixtureDocumentFingerprint = `sha256:${'0'.repeat(64)}`;

    const report = evaluatePolicyCandidateSemanticCounterEvidenceReadiness({
      fixtureDocument,
      referenceSetDocument: buildIndependentReferenceSetDocument(fixtureDocument),
      snapshotReport,
    });

    expect(report.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS.INVALID_EVALUATION,
    );
    expect(report.blockers).toEqual([
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.EVALUATION_SOURCE_INVALID,
    ]);
  });

  test('does not treat a malformed independently-labelled reference set as valid evaluation evidence', () => {
    const fixtureDocument = [buildFixture(1, 'review')];
    const referenceSetDocument = buildIndependentReferenceSetDocument(fixtureDocument);
    referenceSetDocument.labels[0].description = 'Do not retain this';

    const report = evaluatePolicyCandidateSemanticCounterEvidenceReadiness({
      fixtureDocument,
      referenceSetDocument,
      snapshotReport: buildTrustedSnapshotReport(fixtureDocument),
    });

    expect(report.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS.INVALID_EVALUATION,
    );
    expect(report.referenceSet.status.id).toBe('invalid');
    expect(JSON.stringify(report)).not.toContain('Do not retain this');
  });
});
