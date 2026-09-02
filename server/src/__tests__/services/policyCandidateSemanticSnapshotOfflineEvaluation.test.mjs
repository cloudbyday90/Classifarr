/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from '@jest/globals';

import {
  evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument,
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

describe('policyCandidateSemanticSnapshotOfflineEvaluation', () => {
  test('measures a pinned semantic snapshot without admitting it to any workflow', async () => {
    const [fixtureSource, snapshotSource, manifestSource] = await Promise.all([
      readFile(FIXTURE_DOCUMENT_URL, 'utf8'),
      readFile(SNAPSHOT_DOCUMENT_URL, 'utf8'),
      readFile(MANIFEST_URL, 'utf8'),
    ]);
    const report = evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
      fixtureDocument: JSON.parse(fixtureSource),
      manifest: JSON.parse(manifestSource),
      snapshotDocument: JSON.parse(snapshotSource),
    });

    expect(report.authority).toEqual(expect.objectContaining({
      scope: 'offline_evaluation_only',
      operatorWorkflowAdmission: false,
      snapshotAccess: 'validated_fixed_input_read_only',
    }));
    expect(report.evaluation.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        signalId: 'semantic_retrieval_proposal',
        precisionPercent: 66.7,
        recallPercent: 50,
        abstentionRatePercent: 25,
        decisionAgreementRatePercent: 62.5,
      }),
    ]));
    expect(report.semanticSnapshot.signalExpectation).toEqual({
      expectedSignalMatchCount: 8,
      expectedSignalMismatchCount: 0,
    });
    expect(JSON.stringify(report)).not.toContain('queryEmbedding');
  });
});
