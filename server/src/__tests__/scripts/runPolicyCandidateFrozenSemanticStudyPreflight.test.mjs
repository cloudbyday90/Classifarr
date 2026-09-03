/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_PROPOSAL_VERSION,
} from '../../services/policyCandidateFrozenSemanticStudyContract.mjs';
import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
} from '../../services/policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
} from '../../services/policyCandidateSemanticReferenceSetContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from '../../services/policyCandidateSemanticSnapshotFingerprint.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_VERSION,
} from '../../services/policyCandidateSemanticSnapshotContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_VERSION,
} from '../../services/policyCandidateSemanticSnapshotManifestContract.mjs';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../../..');
const SCRIPT_PATH = resolve(PROJECT_ROOT, 'scripts/run-policy-candidate-frozen-semantic-study-preflight.mjs');

function buildBundle() {
  const fixtureDocument = Array.from({ length: 24 }, (_, index) => ({
    id: `preflight-fixture-${index + 1}`,
    name: `Do not emit title ${index + 1}`,
    observations: {
      candidateSetSelectionStatusId: 'changed_outside_candidates',
      contrastiveStatusId: 'alternative_identity_match',
      semanticRetrievalSignalId: 'supports_alternative_candidate',
      semanticSnapshotId: `preflight-snapshot-${index + 1}`,
    },
    reference: { decisionId: 'review' },
    tags: ['broad-policy', 'documentary', 'genre-overlap', 'reality'],
    version: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
  }));
  const snapshotDocument = {
    embeddingSpaceId: 'preflight-study-v1',
    snapshotSetId: 'preflight-study-snapshots',
    snapshots: fixtureDocument.map((fixture) => ({
      candidateEmbeddings: [
        { embedding: [0, 1, 0, 0], roleId: 'leading' },
        { embedding: [1, 0, 0, 0], roleId: 'alternative' },
      ],
      fixtureId: fixture.id,
      id: fixture.observations.semanticSnapshotId,
      queryEmbedding: [1, 0, 0, 0],
      version: POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_VERSION,
    })),
    version: POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_DOCUMENT_VERSION,
  };
  const manifest = {
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
    snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument),
    version: POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_VERSION,
  };
  const referenceSetDocument = {
    fixtureDocumentFingerprint: manifest.fixtureDocumentFingerprint,
    labelingProtocolId: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS
      .INDEPENDENT_DOUBLE_BLIND_HUMAN,
    labels: fixtureDocument.map((fixture) => ({
      consensusStatusId: 'unanimous',
      fixtureId: fixture.id,
      referenceDecisionId: 'review',
      reviewerCount: 2,
    })),
    referenceSetId: 'preflight-study-reference-set',
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  };
  const proposal = {
    accessScopeId: 'authorized_time_bounded_review',
    candidateRetrievalScopeId: 'policy_owned_current_library_candidates',
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
    modelOutputScopeId: 'advisory_candidate_comparison',
    proposalCohortFingerprint: `sha256:${'c'.repeat(64)}`,
    referenceSetDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(referenceSetDocument),
    semanticSnapshotManifestFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(manifest),
    snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument),
    studyId: 'preflight-study',
    studyWindow: {
      expiresAt: '2099-01-02T00:00:00.000Z',
      startsAt: '2099-01-01T00:00:00.000Z',
    },
    version: POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_PROPOSAL_VERSION,
  };
  return { fixtureDocument, manifest, proposal, referenceSetDocument, snapshotDocument };
}

describe('runPolicyCandidateFrozenSemanticStudyPreflight', () => {
  test('accepts a complete bundle, returns aggregate-only output, and never routes', async () => {
    const testDirectoryRoot = resolve(PROJECT_ROOT, '.tmp');
    await mkdir(testDirectoryRoot, { recursive: true });
    const testDirectory = await mkdtemp(join(testDirectoryRoot, 'frozen-study-preflight-'));
    const bundle = buildBundle();
    const entries = Object.entries({
      fixtures: bundle.fixtureDocument,
      manifest: bundle.manifest,
      proposal: bundle.proposal,
      reference: bundle.referenceSetDocument,
      snapshots: bundle.snapshotDocument,
    });

    try {
      await Promise.all(entries.map(([name, value]) => (
        writeFile(join(testDirectory, `${name}.json`), JSON.stringify(value), 'utf8')
      )));
      const result = spawnSync(process.execPath, [
        SCRIPT_PATH,
        '--fixture-file', relative(PROJECT_ROOT, join(testDirectory, 'fixtures.json')),
        '--snapshot-file', relative(PROJECT_ROOT, join(testDirectory, 'snapshots.json')),
        '--manifest-file', relative(PROJECT_ROOT, join(testDirectory, 'manifest.json')),
        '--reference-set-file', relative(PROJECT_ROOT, join(testDirectory, 'reference.json')),
        '--proposal-file', relative(PROJECT_ROOT, join(testDirectory, 'proposal.json')),
      ], { cwd: PROJECT_ROOT, encoding: 'utf8' });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.status.id).toBe('not_ready');
      expect(report.blockers).toContain('proposal_not_active');
      expect(report.authority.automaticActions.routing).toBe(false);
      expect(result.stdout).not.toContain('Do not emit title 1');
      expect(result.stdout).not.toContain('preflight-study');
    } finally {
      await rm(testDirectory, { force: true, recursive: true });
    }
  });

  test('rejects a partial bundle without echoing the supplied source path', () => {
    const suppliedPath = 'scripts/fixtures/policy-candidate-evidence-offline-evaluation.fixtures.json';
    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--fixture-file', suppliedPath,
    ], { cwd: PROJECT_ROOT, encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('Frozen semantic-study preflight could not run.\n');
    expect(result.stderr).not.toContain(suppliedPath);
  });
});
