/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { describe, expect, test } from '@jest/globals';

import {
  generatePolicyCandidateSemanticReferenceSetArtifact,
  loadProjectJsonFile,
} from '../../../../scripts/generate-policy-candidate-semantic-reference-set-artifact.mjs';
import {
  MAX_PROJECT_JSON_INPUT_BYTES,
} from '../../../../scripts/lib/project-json-input.mjs';
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
const SCRIPT_PATH = resolve(
  PROJECT_ROOT,
  'scripts/generate-policy-candidate-semantic-reference-set-artifact.mjs',
);
const READINESS_SCRIPT_PATH = resolve(
  PROJECT_ROOT,
  'scripts/run-policy-candidate-semantic-counter-evidence-readiness-evaluation.mjs',
);
const FIXTURE_FILE = 'scripts/fixtures/policy-candidate-evidence-offline-evaluation.fixtures.json';
const REFERENCE_SET_FILE = 'scripts/fixtures/policy-candidate-semantic-reference-set.synthetic-example.json';

function buildExternalStudyBundle() {
  const fixtureDocument = Array.from({ length: 24 }, (_, index) => ({
    id: `study-fixture-${index + 1}`,
    name: `Redacted study fixture ${index + 1}`,
    observations: {
      candidateSetSelectionStatusId: 'changed_outside_candidates',
      contrastiveStatusId: 'alternative_identity_match',
      semanticRetrievalSignalId: 'supports_alternative_candidate',
      semanticSnapshotId: `study-snapshot-${index + 1}`,
    },
    reference: { decisionId: 'review' },
    tags: ['broad-policy', 'documentary', 'genre-overlap', 'reality'],
    version: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
  }));
  const snapshotDocument = {
    embeddingSpaceId: 'redacted-study-v1',
    snapshotSetId: 'redacted-study-snapshots',
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
    referenceSetId: 'redacted-study-reference-set',
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  };
  return { fixtureDocument, manifest, referenceSetDocument, snapshotDocument };
}

describe('generatePolicyCandidateSemanticReferenceSetArtifact', () => {
  test('emits only a content-free artifact for the checked-in synthetic example', async () => {
    const artifact = await generatePolicyCandidateSemanticReferenceSetArtifact([
      '--fixture-file',
      FIXTURE_FILE,
      '--reference-set-file',
      REFERENCE_SET_FILE,
    ]);

    expect(artifact.status).toEqual({
      id: 'not_independently_labelled',
      independentLabelsAvailable: false,
    });
    expect(JSON.stringify(artifact)).not.toContain('Katrina-like documentary ambiguity');
  });

  test('rejects an input path outside the checkout without echoing it', () => {
    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--fixture-file',
      '../../outside.json',
      '--reference-set-file',
      REFERENCE_SET_FILE,
    ], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('Semantic reference-set artifact generation could not run.\n');
    expect(result.stderr).not.toContain('outside.json');
  });

  test('rejects an in-project junction whose resolved JSON target is outside the checkout', async () => {
    const externalDirectory = await mkdtemp(join(tmpdir(), 'classifarr-reference-set-external-'));
    const testDirectoryRoot = resolve(PROJECT_ROOT, '.tmp');
    await mkdir(testDirectoryRoot, { recursive: true });
    const testDirectory = await mkdtemp(join(testDirectoryRoot, 'reference-set-path-test-'));
    const externalJsonPath = join(externalDirectory, 'reference-set.json');
    const linkPath = join(testDirectory, 'outside-link');

    try {
      await writeFile(externalJsonPath, '{}', 'utf8');
      await symlink(externalDirectory, linkPath, 'junction');
      const linkedJsonPath = relative(PROJECT_ROOT, join(linkPath, 'reference-set.json'));

      await expect(generatePolicyCandidateSemanticReferenceSetArtifact([
        '--fixture-file',
        FIXTURE_FILE,
        '--reference-set-file',
        linkedJsonPath,
      ])).rejects.toThrow('Input must resolve inside the project.');
    } finally {
      await rm(testDirectory, { force: true, recursive: true });
      await rm(externalDirectory, { force: true, recursive: true });
    }
  });

  test('rejects an oversized project JSON input before parsing it', async () => {
    const testDirectoryRoot = resolve(PROJECT_ROOT, '.tmp');
    await mkdir(testDirectoryRoot, { recursive: true });
    const testDirectory = await mkdtemp(join(testDirectoryRoot, 'reference-set-size-test-'));
    const oversizedInputPath = join(testDirectory, 'oversized.json');

    try {
      await writeFile(oversizedInputPath, ' '.repeat(MAX_PROJECT_JSON_INPUT_BYTES + 1), 'utf8');
      await expect(loadProjectJsonFile(relative(PROJECT_ROOT, oversizedInputPath))).rejects
        .toThrow('Input exceeds the offline evaluation size limit.');
    } finally {
      await rm(testDirectory, { force: true, recursive: true });
    }
  });

  test('passes a project-bound reference set into the offline readiness gate', () => {
    const result = spawnSync(process.execPath, [
      READINESS_SCRIPT_PATH,
      '--reference-set-file',
      REFERENCE_SET_FILE,
    ], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.referenceSet.status).toEqual({
      id: 'not_independently_labelled',
      independentLabelsAvailable: false,
    });
    expect(report.blockers).toContain('independent_reference_set_unavailable');
  });

  test('evaluates a complete project-contained redacted study bundle without exposing case text', async () => {
    const testDirectoryRoot = resolve(PROJECT_ROOT, '.tmp');
    await mkdir(testDirectoryRoot, { recursive: true });
    const testDirectory = await mkdtemp(join(testDirectoryRoot, 'semantic-study-input-test-'));
    const bundle = buildExternalStudyBundle();
    const fixturePath = join(testDirectory, 'fixtures.json');
    const snapshotPath = join(testDirectory, 'snapshots.json');
    const manifestPath = join(testDirectory, 'manifest.json');
    const referenceSetPath = join(testDirectory, 'reference-set.json');

    try {
      await Promise.all([
        writeFile(fixturePath, JSON.stringify(bundle.fixtureDocument), 'utf8'),
        writeFile(snapshotPath, JSON.stringify(bundle.snapshotDocument), 'utf8'),
        writeFile(manifestPath, JSON.stringify(bundle.manifest), 'utf8'),
        writeFile(referenceSetPath, JSON.stringify(bundle.referenceSetDocument), 'utf8'),
      ]);
      const result = spawnSync(process.execPath, [
        READINESS_SCRIPT_PATH,
        '--fixture-file', relative(PROJECT_ROOT, fixturePath),
        '--snapshot-file', relative(PROJECT_ROOT, snapshotPath),
        '--manifest-file', relative(PROJECT_ROOT, manifestPath),
        '--reference-set-file', relative(PROJECT_ROOT, referenceSetPath),
      ], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.status.id).toBe('ready_for_human_review');
      expect(report.sourceValidation.fixtureCount).toBe(24);
      expect(report.referenceSet.status).toEqual({
        id: 'independently_labelled',
        independentLabelsAvailable: true,
      });
      expect(report.authority.automaticActions.routing).toBe(false);
      expect(result.stdout).not.toContain('Redacted study fixture 1');
    } finally {
      await rm(testDirectory, { force: true, recursive: true });
    }
  });

  test('rejects a partial external study bundle without echoing the supplied path', () => {
    const result = spawnSync(process.execPath, [
      READINESS_SCRIPT_PATH,
      '--fixture-file',
      FIXTURE_FILE,
      '--reference-set-file',
      REFERENCE_SET_FILE,
    ], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('Offline semantic counter-evidence readiness evaluation could not run.\n');
    expect(result.stderr).not.toContain(FIXTURE_FILE);
  });
});
