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
} from '../../../../scripts/generate-policy-candidate-semantic-reference-set-artifact.mjs';

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
});
