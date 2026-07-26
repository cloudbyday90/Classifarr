/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
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
  POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
} from '../../services/policyStorageClosureRequirementAudit.mjs';
import {
  buildCompletionAuditArtifactFixture,
} from '../services/policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from '../services/policyStorageClosureValidationEvidenceFixture.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/assemble-policy-storage-closure-instance-evidence.mjs',
    import.meta.url
  )
);

function artifactPaths() {
  return [...new Set([
    ...POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
    ...POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
  ].flatMap(component => [
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

function writeJson(rootPath, fileName, value) {
  return writeFile(rootPath, path.join('.artifacts', fileName), `${JSON.stringify(value)}\n`);
}

function completeRoadmapContent() {
  const components = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP;
  return `${components.map(component => `### ${component.label}`).join('\n')}\n\n` +
    `## Policy Storage Closure Work Sequence\n\n` +
    `${components.map((component, index) => `${index + 1}. **${component.label}**`).join('\n')}`;
}

function writeFixtureRepository(fixtureRoot) {
  artifactPaths().forEach(repositoryPath => writeFile(fixtureRoot, repositoryPath));
  writeFile(
    fixtureRoot,
    'docs/architecture/policy-builder-intent-model-roadmap.md',
    completeRoadmapContent()
  );
  writeFile(
    fixtureRoot,
    'CHANGELOG.md',
    '## [Unreleased]\n\n### Added\n\n- **Native Policy Intent Storage** - added durable policy storage.\n'
  );
}

describe('assemble-policy-storage-closure-instance-evidence', () => {
  let fixtureRoot;
  let callerRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-instance-evidence-'));
    callerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-instance-evidence-caller-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(callerRoot, { recursive: true, force: true });
  });

  test('assembles current-closure and requirement-audit artifacts from one selected checkout', async () => {
    writeFixtureRepository(fixtureRoot);
    const completionPath = writeJson(
      fixtureRoot,
      'completion-audit-artifact.json',
      await buildCompletionAuditArtifactFixture()
    );
    const validationPath = writeJson(
      fixtureRoot,
      'validation-evidence.json',
      buildPolicyStorageClosureValidationEvidenceFixture()
    );
    const outputPath = path.join(fixtureRoot, '.artifacts', 'assembly.json');
    const currentClosurePath = path.join(fixtureRoot, '.artifacts', 'current-closure.json');
    const requirementPath = path.join(fixtureRoot, '.artifacts', 'requirement-audit.json');
    const result = spawnSync(process.execPath, [
      GENERATOR_PATH,
      '--cwd', fixtureRoot,
      '--completion-audit-artifact', path.relative(fixtureRoot, completionPath),
      '--validation-evidence', path.relative(fixtureRoot, validationPath),
      '--output', outputPath,
      '--current-closure-output', currentClosurePath,
      '--requirement-audit-output', requirementPath,
      '--generated-at', '2026-07-25T00:00:00.000Z',
      '--require-complete',
    ], {
      cwd: callerRoot,
      encoding: 'utf8',
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({
      complete: true,
      currentClosureAudit: expect.objectContaining({ complete: true }),
      requirementAudit: expect.objectContaining({ complete: true }),
    }));
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8')).requirementAudit)
      .toEqual(expect.objectContaining({ complete: true }));
    expect(JSON.parse(fs.readFileSync(currentClosurePath, 'utf8')))
      .toEqual(expect.objectContaining({ complete: true }));
    expect(JSON.parse(fs.readFileSync(requirementPath, 'utf8')))
      .toEqual(expect.objectContaining({ complete: true }));
  });

  test('fails closed without writing assembly artifacts when validation evidence is incomplete', async () => {
    writeFixtureRepository(fixtureRoot);
    const completionPath = writeJson(
      fixtureRoot,
      'completion-audit-artifact.json',
      await buildCompletionAuditArtifactFixture()
    );
    const validationPath = writeJson(fixtureRoot, 'validation-evidence.json', {});
    const outputPath = path.join(fixtureRoot, '.artifacts', 'assembly.json');
    const result = spawnSync(process.execPath, [
      GENERATOR_PATH,
      '--cwd', fixtureRoot,
      '--completion-audit-artifact', path.relative(fixtureRoot, completionPath),
      '--validation-evidence', path.relative(fixtureRoot, validationPath),
      '--output', outputPath,
    ], {
      cwd: callerRoot,
      encoding: 'utf8',
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('instance evidence assembly is blocked');
    expect(fs.existsSync(outputPath)).toBe(false);
  });
});
