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
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
} from '../../services/policyStorageCompletionCheckpointArtifact.mjs';
import {
  POLICY_STORAGE_IMPLEMENTATION_COMPONENT_IDS,
  buildPolicyStorageCompletionCheckpointArtifactInputs,
  buildPolicyStorageCompletionCheckpointRoadmapEvidence,
} from '../services/policyStorageCompletionCheckpointArtifactFixture.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL('../../../../scripts/generate-policy-storage-completion-checkpoint.mjs', import.meta.url)
);
const GENERATED_AT = '2026-07-15T16:10:00.000Z';

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

async function buildGeneratorInputs(overrides = {}) {
  const inputs = await buildPolicyStorageCompletionCheckpointArtifactInputs();

  return {
    ...inputs,
    ...overrides,
  };
}

function runGenerator({
  fixtureRoot,
  componentEvidence,
  roadmapEvidence,
  completionAuditArtifact,
  validationEvidence,
  changelogEvidence,
  allowBlocked = false,
  requireComplete = false,
} = {}) {
  const componentEvidencePath = writeJson(
    fixtureRoot,
    'component-evidence.json',
    componentEvidence
  );
  const roadmapEvidencePath = writeJson(fixtureRoot, 'roadmap-evidence.json', roadmapEvidence);
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
  const changelogEvidencePath = writeJson(
    fixtureRoot,
    'changelog-evidence.json',
    changelogEvidence
  );
  const outputPath = path.join(fixtureRoot, '.artifacts', 'completion-checkpoint.json');
  const artifactOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'completion-checkpoint-artifact.json'
  );
  const args = [
    GENERATOR_PATH,
    '--component-evidence', componentEvidencePath,
    '--roadmap-evidence', roadmapEvidencePath,
    '--completion-audit-artifact', completionAuditArtifactPath,
    '--validation-evidence', validationEvidencePath,
    '--changelog-evidence', changelogEvidencePath,
    '--output', outputPath,
    '--artifact-output', artifactOutputPath,
    '--generated-at', GENERATED_AT,
  ];

  if (allowBlocked) {
    args.push('--allow-blocked');
  }
  if (requireComplete) {
    args.push('--require-complete');
  }

  const result = spawnSync(process.execPath, args, {
    cwd: fixtureRoot,
    encoding: 'utf8',
  });

  return {
    ...result,
    outputPath,
    artifactOutputPath,
    stdoutJson: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

describe('generate-policy-storage-completion-checkpoint', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-completion-checkpoint-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('exports a complete checkpoint from one coherent evidence chain', async () => {
    const inputs = await buildGeneratorInputs();
    const result = runGenerator({ fixtureRoot, requireComplete: true, ...inputs });
    const checkpoint = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE,
      complete: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(checkpoint).toEqual(artifact.checkpoint);
    expect(checkpoint).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE,
      complete: true,
      finalRemovalAudit: expect.objectContaining({ integrityOk: true }),
      validationEvidenceIntegrity: expect.objectContaining({ ok: true }),
    }));
    expect(artifact.checkpointSummary).toEqual(expect.objectContaining({
      componentExpectedCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENT_IDS.length,
      componentImplementedCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENT_IDS.length,
      validationPassedCount: 4,
    }));
  });

  test('fails closed without output for altered removal, roadmap, or validation evidence', async () => {
    const inputs = await buildGeneratorInputs();
    const alteredCompletionAuditArtifact = structuredClone(inputs.completionAuditArtifact);
    alteredCompletionAuditArtifact.auditSummary.manifestRemovedCount = 0;
    const incompleteRoadmapEvidence = buildPolicyStorageCompletionCheckpointRoadmapEvidence({
      componentSequenceIds: POLICY_STORAGE_IMPLEMENTATION_COMPONENT_IDS.slice(1),
    });
    const alteredValidationEvidence = structuredClone(inputs.validationEvidence);
    alteredValidationEvidence.validationInput.commandResults[0].exitCode = 1;
    const cases = [
      [{ ...inputs, completionAuditArtifact: alteredCompletionAuditArtifact },
        POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_FINAL_REMOVAL_AUDIT],
      [{ ...inputs, roadmapEvidence: incompleteRoadmapEvidence },
        POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE],
      [{ ...inputs, validationEvidence: alteredValidationEvidence },
        POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION],
    ];

    cases.forEach(([caseInputs, expectedCheckpointStatusId]) => {
      const result = runGenerator({ fixtureRoot, ...caseInputs });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdoutJson).toBeNull();
      expect(result.stderr).toContain('artifact is blocked');
      expect(result.stderr).toContain(expectedCheckpointStatusId);
      expect(fs.existsSync(result.outputPath)).toBe(false);
      expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
    });
  });

  test('writes a blocked checkpoint diagnostic only with explicit allowance', async () => {
    const inputs = await buildGeneratorInputs({
      roadmapEvidence: buildPolicyStorageCompletionCheckpointRoadmapEvidence({
        implementationStatusComponentIds: POLICY_STORAGE_IMPLEMENTATION_COMPONENT_IDS.slice(1),
      }),
    });
    const result = runGenerator({ fixtureRoot, allowBlocked: true, ...inputs });
    const checkpoint = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED,
      complete: false,
    }));
    expect(checkpoint).toEqual(artifact.checkpoint);
    expect(checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(artifact.sideEffects).toEqual(expect.objectContaining({
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
      manifestWritten: false,
    }));
  });
});
