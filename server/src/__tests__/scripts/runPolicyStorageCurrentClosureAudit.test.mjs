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
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
} from '../../services/policyStorageClosureEvidenceRun.mjs';
import {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS,
} from '../../services/policyStorageCurrentClosureAudit.mjs';
import {
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS,
} from '../../services/policyStorageFinalClosureReadout.mjs';
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
    '../../../../scripts/run-policy-storage-current-closure-audit.mjs',
    import.meta.url
  )
);
const GENERATED_AT = '2026-07-15T17:00:00.000Z';

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
  writeFile(fixtureRoot, 'CHANGELOG.md', completeChangelogContent());
}

function writeJson(rootPath, fileName, value) {
  return writeFile(rootPath, path.join('.artifacts', fileName), `${JSON.stringify(value, null, 2)}\n`);
}

async function buildGeneratorInputs({
  completionAuditArtifact = undefined,
  validationEvidence = undefined,
} = {}) {
  return {
    completionAuditArtifact:
      completionAuditArtifact === undefined
        ? await buildCompletionAuditArtifactFixture()
        : completionAuditArtifact,
    validationEvidence:
      validationEvidence === undefined
        ? buildPolicyStorageClosureValidationEvidenceFixture()
        : validationEvidence,
  };
}

function runGenerator({
  fixtureRoot,
  callerRoot = fixtureRoot,
  completionAuditArtifact,
  validationEvidence,
  allowBlocked = false,
  requireComplete = false,
  useRelativeArtifactPaths = false,
} = {}) {
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
  const outputPath = path.join(fixtureRoot, '.artifacts', 'current-closure-audit.json');
  const checkpointArtifactOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'completion-checkpoint-artifact.json'
  );
  const finalReadoutOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'final-closure-readout.json'
  );
  const toArgumentPath = filePath => (
    useRelativeArtifactPaths ? path.relative(fixtureRoot, filePath) : filePath
  );
  const args = [
    GENERATOR_PATH,
    '--cwd', fixtureRoot,
    '--completion-audit-artifact', toArgumentPath(completionAuditArtifactPath),
    '--validation-evidence', toArgumentPath(validationEvidencePath),
    '--output', toArgumentPath(outputPath),
    '--checkpoint-artifact-output', toArgumentPath(checkpointArtifactOutputPath),
    '--final-readout-output', toArgumentPath(finalReadoutOutputPath),
    '--generated-at', GENERATED_AT,
  ];

  if (allowBlocked) {
    args.push('--allow-blocked');
  }
  if (requireComplete) {
    args.push('--require-complete');
  }

  const result = spawnSync(process.execPath, args, {
    cwd: callerRoot,
    encoding: 'utf8',
  });

  return {
    ...result,
    outputPath,
    checkpointArtifactOutputPath,
    finalReadoutOutputPath,
    stdoutJson: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

describe('run-policy-storage-current-closure-audit', () => {
  let fixtureRoot;
  let callerRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-current-closure-'));
    callerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-current-closure-caller-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(callerRoot, { recursive: true, force: true });
  });

  test('exports one coherent current-evidence, checkpoint, and final-readout chain', async () => {
    writeFixtureRepository({ fixtureRoot });
    const inputs = await buildGeneratorInputs();
    const result = runGenerator({
      fixtureRoot,
      ...inputs,
      requireComplete: true,
    });
    const audit = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const checkpointArtifact = JSON.parse(
      fs.readFileSync(result.checkpointArtifactOutputPath, 'utf8')
    );
    const finalReadout = JSON.parse(
      fs.readFileSync(result.finalReadoutOutputPath, 'utf8')
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE,
      complete: true,
      validation: expect.objectContaining({ ok: true }),
      artifactFingerprint: expect.objectContaining({
        algorithm: 'sha256',
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }));
    expect(audit).toEqual(result.stdoutJson);
    expect(checkpointArtifact).toEqual(audit.checkpointArtifact);
    expect(finalReadout).toEqual(audit.finalReadout);
    expect(finalReadout).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE,
      complete: true,
      checkpointArtifactIntegrity: expect.objectContaining({ ok: true }),
    }));
  });

  test('binds relative evidence inputs and outputs to --cwd instead of the caller', async () => {
    writeFixtureRepository({ fixtureRoot });
    const inputs = await buildGeneratorInputs();
    const result = runGenerator({
      fixtureRoot,
      callerRoot,
      useRelativeArtifactPaths: true,
      requireComplete: true,
      ...inputs,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(fs.existsSync(result.checkpointArtifactOutputPath)).toBe(true);
    expect(fs.existsSync(result.finalReadoutOutputPath)).toBe(true);
    expect(fs.existsSync(path.join(callerRoot, '.artifacts', 'current-closure-audit.json')))
      .toBe(false);
    expect(fs.existsSync(
      path.join(callerRoot, '.artifacts', 'completion-checkpoint-artifact.json')
    )).toBe(false);
    expect(fs.existsSync(path.join(callerRoot, '.artifacts', 'final-closure-readout.json')))
      .toBe(false);
  });

  test('fails closed without output when supplied validation evidence is altered', async () => {
    writeFixtureRepository({ fixtureRoot });
    const inputs = await buildGeneratorInputs();
    inputs.validationEvidence.validationInput.commandResults[0].exitCode = 1;
    const result = runGenerator({ fixtureRoot, ...inputs });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('current closure audit is blocked');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.checkpointArtifactOutputPath)).toBe(false);
    expect(fs.existsSync(result.finalReadoutOutputPath)).toBe(false);
  });

  test('writes a blocked current-checkout diagnostic only with explicit allowance', async () => {
    const missingPath = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP[0]
      .contractPaths[0];
    writeFixtureRepository({ fixtureRoot, missingPaths: [missingPath] });
    const inputs = await buildGeneratorInputs();
    const result = runGenerator({
      fixtureRoot,
      ...inputs,
      allowBlocked: true,
    });
    const audit = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const checkpointArtifact = JSON.parse(
      fs.readFileSync(result.checkpointArtifactOutputPath, 'utf8')
    );
    const finalReadout = JSON.parse(
      fs.readFileSync(result.finalReadoutOutputPath, 'utf8')
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
          .BLOCKED_BY_CURRENT_EVIDENCE,
      complete: false,
    }));
    expect(audit).toEqual(result.stdoutJson);
    expect(checkpointArtifact).toEqual(audit.checkpointArtifact);
    expect(finalReadout).toEqual(audit.finalReadout);
  });
});
