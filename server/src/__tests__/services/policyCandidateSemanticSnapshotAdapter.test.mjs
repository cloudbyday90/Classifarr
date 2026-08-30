/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_ADAPTER_RISK_IDS,
  buildPolicyCandidateSemanticSnapshotSignals,
} from '../../services/policyCandidateSemanticSnapshotAdapter.mjs';

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

async function loadDocuments() {
  const [fixtureSource, snapshotSource, manifestSource] = await Promise.all([
    readFile(FIXTURE_DOCUMENT_URL, 'utf8'),
    readFile(SNAPSHOT_DOCUMENT_URL, 'utf8'),
    readFile(MANIFEST_URL, 'utf8'),
  ]);
  return {
    fixtureDocument: JSON.parse(fixtureSource),
    manifest: JSON.parse(manifestSource),
    snapshotDocument: JSON.parse(snapshotSource),
  };
}

describe('policyCandidateSemanticSnapshotAdapter', () => {
  test('uses the pinned committed artifacts and emits status-only signals', async () => {
    const result = buildPolicyCandidateSemanticSnapshotSignals(await loadDocuments());

    expect(result.ok).toBe(true);
    expect(result.provenance).toEqual(expect.objectContaining({
      fixtureCount: 8,
      snapshotCount: 8,
      embeddingSpaceId: 'synthetic-redacted-v1',
    }));
    expect(result.signals).toEqual(expect.arrayContaining([
      { fixtureId: 'katrina-like-documentary-ambiguity', semanticRetrievalSignalId: 'supports_alternative_candidate' },
      { fixtureId: 'low-margin-semantic-uncertainty', semanticRetrievalSignalId: 'abstain' },
    ]));
    expect(JSON.stringify(result)).not.toContain('queryEmbedding');
    expect(JSON.stringify(result)).not.toContain('candidateEmbeddings');
  });

  test('fails closed when the manifest pin no longer matches its fixed document', async () => {
    const input = await loadDocuments();
    input.manifest.snapshotDocumentFingerprint = `sha256:${'0'.repeat(64)}`;

    const result = buildPolicyCandidateSemanticSnapshotSignals(input);

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      provenance: null,
      signals: [],
    }));
    expect(result.validation.binding.riskIds).toContain(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_ADAPTER_RISK_IDS.SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH,
    );
  });
});
