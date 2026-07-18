/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
} from '../../services/policyStorageClosureEvidenceRun.mjs';
import {
  buildCompletionAuditArtifactFixture,
} from '../services/policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from '../services/policyStorageClosureValidationEvidenceFixture.mjs';
import {
  completeChangelogContent,
  completeRoadmapContent,
} from '../services/policyStorageCurrentClosureAuditFixture.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/run-policy-storage-closure-evidence.mjs',
    import.meta.url
  )
);

function artifactPaths() {
  return [...new Set(POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
    .flatMap(component => [
      ...component.designDocPaths,
      ...component.contractPaths,
      ...component.testPaths,
    ]))];
}

function writeFile(rootPath, repositoryPath, content = 'fixture artifact\n') {
  const filePath = path.join(rootPath, repositoryPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function writeFixtureRepository(fixtureRoot) {
  artifactPaths().forEach(repositoryPath => writeFile(fixtureRoot, repositoryPath));
  writeFile(
    fixtureRoot,
    'docs/architecture/policy-builder-intent-model-roadmap.md',
    completeRoadmapContent()
  );
  writeFile(fixtureRoot, 'CHANGELOG.md', completeChangelogContent());
}

function writeJson(rootPath, fileName, value) {
  return writeFile(rootPath, path.join('.artifacts', fileName), `${JSON.stringify(value)}\n`);
}

describe('run-policy-storage-closure-evidence', () => {
  let fixtureRoot;
  let callerRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-storage-closure-'));
    callerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-storage-closure-caller-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(callerRoot, { recursive: true, force: true });
  });

  test('reads relative evidence artifacts from --cwd instead of the caller', async () => {
    writeFixtureRepository(fixtureRoot);
    const completionAuditArtifactPath = writeJson(
      fixtureRoot,
      'completion-audit-artifact.json',
      await buildCompletionAuditArtifactFixture()
    );
    const validationEvidencePath = writeJson(
      fixtureRoot,
      'validation-evidence.json',
      buildPolicyStorageClosureValidationEvidenceFixture()
    );
    const result = spawnSync(process.execPath, [
      GENERATOR_PATH,
      '--cwd', fixtureRoot,
      '--completion-audit-artifact', path.relative(fixtureRoot, completionAuditArtifactPath),
      '--validation-evidence', path.relative(fixtureRoot, validationEvidencePath),
      '--require-complete',
    ], {
      cwd: callerRoot,
      encoding: 'utf8',
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({
      evidenceRun: expect.objectContaining({ complete: true }),
    }));
  });
});
