/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
  POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS,
} from '../../services/policyStorageClosureRequirementAudit.mjs';
import {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS,
} from '../../services/policyStorageCurrentClosureAudit.mjs';
import {
  buildCompletionAuditArtifactFixture,
} from '../services/policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from '../services/policyStorageClosureValidationEvidenceFixture.mjs';

const CURRENT_CLOSURE_GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/run-policy-storage-current-closure-audit.mjs',
    import.meta.url
  )
);
const REQUIREMENT_AUDIT_GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/run-policy-storage-closure-requirement-audit.mjs',
    import.meta.url
  )
);
const GENERATED_AT = '2026-07-15T18:00:00.000Z';

function artifactPaths() {
  return [...new Set(POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .flatMap(component => [
      ...component.designDocPaths,
      ...component.contractPaths,
      ...component.testPaths,
    ]))];
}

function completeRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map(component => `### ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function writeFile(rootPath, repositoryPath, content = 'fixture artifact\n') {
  const filePath = path.join(rootPath, repositoryPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function writeFixtureRepository({ fixtureRoot, missingPaths = [] } = {}) {
  const missingPathSet = new Set(missingPaths);

  artifactPaths().forEach(repositoryPath => {
    if (!missingPathSet.has(repositoryPath)) {
      writeFile(fixtureRoot, repositoryPath);
    }
  });

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

function writeJson(rootPath, fileName, value) {
  return writeFile(
    rootPath,
    path.join('.artifacts', fileName),
    `${JSON.stringify(value, null, 2)}\n`
  );
}

function runNodeCommand({ fixtureRoot, scriptPath, args = [] } = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: fixtureRoot,
    encoding: 'utf8',
  });
}

async function generateCurrentClosureAudit({ fixtureRoot } = {}) {
  const completionAuditArtifact = await buildCompletionAuditArtifactFixture();
  const validationEvidence = buildPolicyStorageClosureValidationEvidenceFixture();
  const completionAuditArtifactPath = writeJson(
    fixtureRoot,
    'completion-audit-artifact.json',
    completionAuditArtifact
  );
  const validationEvidencePath = writeJson(
    fixtureRoot,
    'validation-evidence.json',
    validationEvidence
  );
  const currentClosureAuditPath = path.join(
    fixtureRoot,
    '.artifacts',
    'current-closure-audit.json'
  );
  const result = runNodeCommand({
    fixtureRoot,
    scriptPath: CURRENT_CLOSURE_GENERATOR_PATH,
    args: [
      '--cwd', fixtureRoot,
      '--completion-audit-artifact', completionAuditArtifactPath,
      '--validation-evidence', validationEvidencePath,
      '--output', currentClosureAuditPath,
      '--generated-at', GENERATED_AT,
      '--require-complete',
    ],
  });

  return {
    ...result,
    currentClosureAuditPath,
    audit: fs.existsSync(currentClosureAuditPath)
      ? JSON.parse(fs.readFileSync(currentClosureAuditPath, 'utf8'))
      : null,
  };
}

function runRequirementAudit({
  fixtureRoot,
  currentClosureAuditPath,
  allowBlocked = false,
  requireComplete = false,
} = {}) {
  const outputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'closure-requirement-audit.json'
  );
  const args = [
    '--cwd', fixtureRoot,
    '--current-closure-audit', currentClosureAuditPath,
    '--output', outputPath,
    '--generated-at', GENERATED_AT,
  ];

  if (allowBlocked) {
    args.push('--allow-blocked');
  }
  if (requireComplete) {
    args.push('--require-complete');
  }

  const result = runNodeCommand({
    fixtureRoot,
    scriptPath: REQUIREMENT_AUDIT_GENERATOR_PATH,
    args,
  });

  return {
    ...result,
    outputPath,
    stdoutJson: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

describe('run-policy-storage-closure-requirement-audit', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-requirement-audit-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('exports a complete requirement audit from a coherent public current-closure chain', async () => {
    writeFixtureRepository({ fixtureRoot });
    const currentClosureResult = await generateCurrentClosureAudit({ fixtureRoot });
    const result = runRequirementAudit({
      fixtureRoot,
      currentClosureAuditPath: currentClosureResult.currentClosureAuditPath,
      requireComplete: true,
    });
    const audit = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));

    expect(currentClosureResult.error).toBeUndefined();
    expect(currentClosureResult.status).toBe(0);
    expect(currentClosureResult.audit).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE,
      complete: true,
    }));
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE,
      complete: true,
      currentClosureAudit: expect.objectContaining({
        integrityOk: true,
        artifactFingerprint:
          currentClosureResult.audit.artifactFingerprint.fingerprint,
      }),
    }));
    expect(audit).toEqual(result.stdoutJson);
  });

  test('fails closed without output when the supplied current-closure artifact is altered', async () => {
    writeFixtureRepository({ fixtureRoot });
    const currentClosureResult = await generateCurrentClosureAudit({ fixtureRoot });
    currentClosureResult.audit.summary.missingCurrentArtifactCount = 1;
    writeJson(
      fixtureRoot,
      'current-closure-audit.json',
      currentClosureResult.audit
    );
    const result = runRequirementAudit({
      fixtureRoot,
      currentClosureAuditPath: currentClosureResult.currentClosureAuditPath,
    });

    expect(currentClosureResult.status).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('requirement audit is blocked');
    expect(fs.existsSync(result.outputPath)).toBe(false);
  });

  test('writes a missing requirement-evidence diagnostic only with explicit allowance', async () => {
    const missingPath = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
      .find(component => component.componentId === 'storage_current_closure_audit')
      .contractPaths[0];
    writeFixtureRepository({ fixtureRoot, missingPaths: [missingPath] });
    const currentClosureResult = await generateCurrentClosureAudit({ fixtureRoot });
    const result = runRequirementAudit({
      fixtureRoot,
      currentClosureAuditPath: currentClosureResult.currentClosureAuditPath,
      allowBlocked: true,
    });
    const audit = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));

    expect(currentClosureResult.status).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_COMPONENT_EVIDENCE,
      complete: false,
    }));
    expect(audit).toEqual(result.stdoutJson);
  });
});
