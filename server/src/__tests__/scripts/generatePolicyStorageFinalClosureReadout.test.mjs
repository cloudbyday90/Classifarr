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
  buildPolicyStorageCompletionCheckpointArtifact,
} from '../../services/policyStorageCompletionCheckpointArtifact.mjs';
import {
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS,
} from '../../services/policyStorageFinalClosureReadout.mjs';
import {
  POLICY_STORAGE_COMPLETION_COMPONENT_IDS,
  buildPolicyStorageCompletionCheckpointArtifactInputs,
} from '../services/policyStorageCompletionCheckpointArtifactFixture.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/generate-policy-storage-final-closure-readout.mjs',
    import.meta.url
  )
);
const GENERATED_AT = '2026-07-15T16:30:00.000Z';

async function buildCheckpointArtifact(overrides = {}) {
  const inputs = await buildPolicyStorageCompletionCheckpointArtifactInputs(
    overrides
  );

  return buildPolicyStorageCompletionCheckpointArtifact({
    ...inputs,
    generatedAt: GENERATED_AT,
  });
}

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function runGenerator({
  fixtureRoot,
  checkpointArtifact,
  allowBlocked = false,
  requireComplete = false,
} = {}) {
  const checkpointArtifactPath = writeJson(
    fixtureRoot,
    'completion-checkpoint-artifact.json',
    checkpointArtifact
  );
  const outputPath = path.join(fixtureRoot, '.artifacts', 'final-closure-readout.json');
  const args = [
    GENERATOR_PATH,
    '--checkpoint-artifact', checkpointArtifactPath,
    '--output', outputPath,
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
    stdoutJson: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

describe('generate-policy-storage-final-closure-readout', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-final-closure-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('exports a complete final readout from one fingerprint-valid replayable checkpoint artifact', async () => {
    const checkpointArtifact = await buildCheckpointArtifact();
    const result = runGenerator({
      fixtureRoot,
      checkpointArtifact,
      requireComplete: true,
    });
    const readout = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE,
      complete: true,
      validation: expect.objectContaining({ ok: true }),
      checkpointArtifactIntegrity: expect.objectContaining({
        ok: true,
        artifactFingerprint: checkpointArtifact.artifactFingerprint.fingerprint,
      }),
    }));
    expect(readout).toEqual(result.stdoutJson);
  });

  test('fails closed without output for a tampered checkpoint artifact', async () => {
    const checkpointArtifact = await buildCheckpointArtifact();
    checkpointArtifact.checkpointSummary.componentImplementedCount = 0;
    const result = runGenerator({ fixtureRoot, checkpointArtifact });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('final closure readout is blocked');
    expect(result.stderr).toContain(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_ARTIFACT_VALIDATION
    );
    expect(fs.existsSync(result.outputPath)).toBe(false);
  });

  test('writes a replayable blocked diagnostic only with explicit allowance', async () => {
    const checkpointArtifact = await buildCheckpointArtifact({
      roadmapEvidenceOverrides: {
        componentSequenceIds: POLICY_STORAGE_COMPLETION_COMPONENT_IDS.slice(1),
      },
    });
    const result = runGenerator({
      fixtureRoot,
      checkpointArtifact,
      allowBlocked: true,
    });
    const readout = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
          .BLOCKED_BY_ROADMAP_EVIDENCE,
      complete: false,
      checkpointArtifactIntegrity: expect.objectContaining({ ok: true }),
    }));
    expect(readout).toEqual(result.stdoutJson);
  });
});
