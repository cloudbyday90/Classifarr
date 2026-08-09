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

import { jest } from '@jest/globals';

import {
  PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS,
  PublishedDigestConsumerSmokeError,
  createConsumerSmokeProjectName,
  parsePublishedImageReference,
  runPublishedDigestConsumerSmoke,
} from '../../../../scripts/lib/publishedDigestConsumerSmoke.mjs';
import { parsePublishedDigestConsumerSmokeCliArgs } from '../../../../scripts/run-published-digest-consumer-smoke.mjs';

const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const IMAGE = `ghcr.io/cloudbyday90/classifarr@${DIGEST}`;
const PROJECT_NAME = 'classifarr-release-smoke-0123456789ab-1234';
const CWD = 'C:\\workspace\\classifarr';
const COMPOSE_FILE = 'C:\\workspace\\classifarr\\docker-compose.release-smoke.yml';

function createSuccessfulCommandRunner() {
  return jest.fn(() => ({ status: 0, stderr: '', stdout: '' }));
}

function runSmoke({ commandRunner = createSuccessfulCommandRunner() } = {}) {
  return runPublishedDigestConsumerSmoke({
    commandRunner,
    composeFile: COMPOSE_FILE,
    cwd: CWD,
    image: IMAGE,
    now: () => new Date('2026-08-09T00:00:00.000Z'),
    projectName: PROJECT_NAME,
    sourceRevision: SOURCE_REVISION,
  });
}

describe('publishedDigestConsumerSmoke', () => {
  test('accepts only published Classifarr digest subjects', () => {
    expect(parsePublishedImageReference(IMAGE)).toEqual({
      digest: DIGEST,
      image: IMAGE,
      repository: 'ghcr.io/cloudbyday90/classifarr',
    });

    expect(() => parsePublishedImageReference('ghcr.io/cloudbyday90/classifarr:v1.0.0'))
      .toThrow(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
    expect(() => parsePublishedImageReference(`ghcr.io/attacker/classifarr@${DIGEST}`))
      .toThrow(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
  });

  test('uses consumer provenance verification and an isolated no-build Compose lifecycle', () => {
    const commandRunner = createSuccessfulCommandRunner();

    const evidence = runSmoke({ commandRunner });

    expect(evidence).toEqual({
      checks: {
        compose_configuration: 'validated',
        compose_startup: 'healthy',
        migration_readiness: 'ready',
        provenance: 'verified',
        runtime_health: 'healthy',
        teardown: 'completed',
      },
      completed_at: '2026-08-09T00:00:00.000Z',
      image: IMAGE,
      schema_version: 'classifarr.release.published-digest-consumer-smoke.v1',
      signer_workflow: 'cloudbyday90/Classifarr/.github/workflows/ci.yml',
      source_repository: 'cloudbyday90/Classifarr',
      source_revision: SOURCE_REVISION,
    });
    expect(commandRunner).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.arrayContaining([
        'attestation',
        'verify',
        `oci://${IMAGE}`,
        '--source-digest',
        SOURCE_REVISION,
        '--signer-workflow',
        'cloudbyday90/Classifarr/.github/workflows/ci.yml',
        '--deny-self-hosted-runners',
        '--no-public-good',
      ]),
      command: 'gh',
    }));
    expect(commandRunner).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.arrayContaining([
        'up',
        '--detach',
        '--wait',
        '--wait-timeout',
        '180',
        '--pull',
        'always',
        '--no-build',
      ]),
      command: 'docker',
      env: { CLASSIFARR_RELEASE_SMOKE_IMAGE: IMAGE },
    }));
    expect(commandRunner).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.arrayContaining(['http://127.0.0.1:21324/health']),
      command: 'docker',
    }));
    expect(commandRunner).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.arrayContaining(['http://127.0.0.1:21324/api/system/health/ready']),
      command: 'docker',
    }));
    expect(commandRunner).toHaveBeenLastCalledWith(expect.objectContaining({
      args: expect.arrayContaining(['down', '--volumes', '--remove-orphans']),
      command: 'docker',
    }));
  });

  test('fails closed before Compose when consumer provenance is absent or mismatched', () => {
    const commandRunner = jest.fn(() => ({ status: 1, stderr: 'not trusted', stdout: '' }));

    expect(() => runSmoke({ commandRunner })).toThrow(
      new PublishedDigestConsumerSmokeError(
        PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.PROVENANCE_VERIFICATION_FAILED
      )
    );
    expect(commandRunner).toHaveBeenCalledTimes(1);
    expect(commandRunner.mock.calls[0][0].command).toBe('gh');
  });

  test('tears down the isolated project after a bounded health failure without exposing output', () => {
    const commandRunner = jest.fn(({ args }) => ({
      status: args.includes('http://127.0.0.1:21324/health') ? 1 : 0,
      stderr: 'do not expose runtime output',
      stdout: 'do not expose runtime output',
    }));

    expect(() => runSmoke({ commandRunner })).toThrow(
      PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.RUNTIME_HEALTH_FAILED
    );
    expect(commandRunner).toHaveBeenLastCalledWith(expect.objectContaining({
      args: expect.arrayContaining(['down', '--volumes', '--remove-orphans']),
      command: 'docker',
    }));
  });

  test('derives a valid isolated Compose project name from a full revision', () => {
    expect(createConsumerSmokeProjectName({ processId: 1234, sourceRevision: SOURCE_REVISION }))
      .toBe(PROJECT_NAME);
  });

  test('keeps CLI evidence output under the fixed temporary evidence root', () => {
    const options = parsePublishedDigestConsumerSmokeCliArgs([
      '--image',
      IMAGE,
      '--source-revision',
      SOURCE_REVISION,
      '--wait-timeout',
      '120',
    ], { cwd: CWD });

    expect(options).toEqual(expect.objectContaining({
      image: IMAGE,
      outputPath: expect.stringContaining('release-consumer-smoke'),
      sourceRevision: SOURCE_REVISION,
      waitTimeoutSeconds: 120,
    }));
    expect(() => parsePublishedDigestConsumerSmokeCliArgs([
      '--image',
      IMAGE,
      '--source-revision',
      SOURCE_REVISION,
      '--output',
      'anywhere.json',
    ], { cwd: CWD })).toThrow(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
  });
});
