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
import process from 'node:process';
import { resolve } from 'node:path';

export const PUBLISHED_DIGEST_CONSUMER_SMOKE_SCHEMA_VERSION =
  'classifarr.release.published-digest-consumer-smoke.v1';

export const PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS = Object.freeze({
  COMPOSE_CONFIGURATION_FAILED: 'compose_configuration_failed',
  COMPOSE_START_FAILED: 'compose_start_failed',
  INVALID_INPUT: 'invalid_input',
  MIGRATION_READINESS_FAILED: 'migration_readiness_failed',
  PROVENANCE_VERIFICATION_FAILED: 'provenance_verification_failed',
  RUNTIME_HEALTH_FAILED: 'runtime_health_failed',
  TEARDOWN_FAILED: 'teardown_failed',
});

export const PUBLISHED_IMAGE_REPOSITORIES = Object.freeze([
  'docker.io/cloudbyday90/classifarr',
  'ghcr.io/cloudbyday90/classifarr',
]);

export const EXPECTED_RELEASE_REPOSITORY = 'cloudbyday90/Classifarr';
export const EXPECTED_SIGNER_WORKFLOW =
  'cloudbyday90/Classifarr/.github/workflows/ci.yml';
export const DEFAULT_COMPOSE_FILE = resolve(
  import.meta.dirname,
  '../../docker-compose.release-smoke.yml'
);
export const DEFAULT_WAIT_TIMEOUT_SECONDS = 180;

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const REVISION_PATTERN = /^[a-f0-9]{40,64}$/u;
const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u;

export class PublishedDigestConsumerSmokeError extends Error {
  constructor(statusId) {
    super(`Published digest consumer smoke failed: ${statusId}.`);
    this.name = 'PublishedDigestConsumerSmokeError';
    this.statusId = statusId;
  }
}

function createSystemCommandRunner() {
  return ({ command, args, cwd, env }) => spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
    shell: false,
    windowsHide: true,
  });
}

function throwInvalidInput() {
  throw new PublishedDigestConsumerSmokeError(
    PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT
  );
}

function assertString(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throwInvalidInput();
  }
}

export function parsePublishedImageReference(image) {
  assertString(image);

  const atIndex = image.lastIndexOf('@');
  if (atIndex <= 0 || atIndex !== image.indexOf('@')) {
    throwInvalidInput();
  }

  const repository = image.slice(0, atIndex);
  const digest = image.slice(atIndex + 1).toLowerCase();
  if (!PUBLISHED_IMAGE_REPOSITORIES.includes(repository) || !DIGEST_PATTERN.test(digest)) {
    throwInvalidInput();
  }

  return {
    digest,
    image: `${repository}@${digest}`,
    repository,
  };
}

export function assertSourceRevision(sourceRevision) {
  assertString(sourceRevision);
  const normalizedRevision = sourceRevision.toLowerCase();
  if (!REVISION_PATTERN.test(normalizedRevision)) {
    throwInvalidInput();
  }
  return normalizedRevision;
}

export function createConsumerSmokeProjectName({
  processId = process.pid,
  sourceRevision,
} = {}) {
  const revision = assertSourceRevision(sourceRevision);
  const normalizedProcessId = Number.parseInt(String(processId), 10);
  if (!Number.isSafeInteger(normalizedProcessId) || normalizedProcessId < 1) {
    throwInvalidInput();
  }

  return `classifarr-release-smoke-${revision.slice(0, 12)}-${normalizedProcessId}`;
}

function assertProjectName(projectName) {
  assertString(projectName);
  if (!PROJECT_NAME_PATTERN.test(projectName)) {
    throwInvalidInput();
  }
}

function assertWaitTimeout(waitTimeoutSeconds) {
  if (
    !Number.isSafeInteger(waitTimeoutSeconds) ||
    waitTimeoutSeconds < 30 ||
    waitTimeoutSeconds > 300
  ) {
    throwInvalidInput();
  }
}

function runRequiredCommand({ command, args, commandRunner, cwd, env, statusId }) {
  let result;
  try {
    result = commandRunner({ command, args, cwd, env });
  } catch (_error) {
    throw new PublishedDigestConsumerSmokeError(statusId);
  }

  if (result?.status !== 0) {
    throw new PublishedDigestConsumerSmokeError(statusId);
  }
}

function createComposeArgs({ composeFile, cwd, projectName }) {
  return [
    'compose',
    '--project-name',
    projectName,
    '--file',
    composeFile,
    '--project-directory',
    cwd,
  ];
}

function createEvidence({ image, sourceRevision, completedAt }) {
  return {
    checks: {
      compose_configuration: 'validated',
      compose_startup: 'healthy',
      migration_readiness: 'ready',
      provenance: 'verified',
      runtime_health: 'healthy',
      teardown: 'completed',
    },
    completed_at: completedAt,
    image,
    schema_version: PUBLISHED_DIGEST_CONSUMER_SMOKE_SCHEMA_VERSION,
    signer_workflow: EXPECTED_SIGNER_WORKFLOW,
    source_repository: EXPECTED_RELEASE_REPOSITORY,
    source_revision: sourceRevision,
  };
}

/**
 * Verifies and starts only an immutable release digest. It deliberately uses a
 * separately named Compose project, no host ports, and a project-scoped volume
 * so a release check cannot inspect or alter an existing installation.
 */
export function runPublishedDigestConsumerSmoke({
  commandRunner = createSystemCommandRunner(),
  composeFile = DEFAULT_COMPOSE_FILE,
  cwd = process.cwd(),
  image,
  now = () => new Date(),
  projectName,
  sourceRevision,
  waitTimeoutSeconds = DEFAULT_WAIT_TIMEOUT_SECONDS,
} = {}) {
  const publishedImage = parsePublishedImageReference(image);
  const verifiedSourceRevision = assertSourceRevision(sourceRevision);
  const resolvedProjectName = projectName || createConsumerSmokeProjectName({
    sourceRevision: verifiedSourceRevision,
  });

  assertProjectName(resolvedProjectName);
  assertWaitTimeout(waitTimeoutSeconds);
  assertString(composeFile);
  assertString(cwd);

  const commandEnvironment = {
    CLASSIFARR_RELEASE_SMOKE_IMAGE: publishedImage.image,
  };
  const composeArgs = createComposeArgs({
    composeFile,
    cwd,
    projectName: resolvedProjectName,
  });
  let composeMayNeedTeardown = false;
  let failure = null;

  try {
    runRequiredCommand({
      args: [
        'attestation',
        'verify',
        `oci://${publishedImage.image}`,
        '--repo',
        EXPECTED_RELEASE_REPOSITORY,
        '--signer-workflow',
        EXPECTED_SIGNER_WORKFLOW,
        '--source-digest',
        verifiedSourceRevision,
        '--deny-self-hosted-runners',
      ],
      command: 'gh',
      commandRunner,
      cwd,
      env: commandEnvironment,
      statusId: PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.PROVENANCE_VERIFICATION_FAILED,
    });

    runRequiredCommand({
      args: [...composeArgs, 'config', '--quiet'],
      command: 'docker',
      commandRunner,
      cwd,
      env: commandEnvironment,
      statusId: PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.COMPOSE_CONFIGURATION_FAILED,
    });

    composeMayNeedTeardown = true;
    runRequiredCommand({
      args: [
        ...composeArgs,
        'up',
        '--detach',
        '--wait',
        '--wait-timeout',
        String(waitTimeoutSeconds),
        '--pull',
        'always',
        '--no-build',
        '--remove-orphans',
      ],
      command: 'docker',
      commandRunner,
      cwd,
      env: commandEnvironment,
      statusId: PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.COMPOSE_START_FAILED,
    });

    runRequiredCommand({
      args: [
        ...composeArgs,
        'exec',
        '--no-TTY',
        'classifarr',
        'curl',
        '--fail',
        '--silent',
        '--show-error',
        '--output',
        '/dev/null',
        '--max-time',
        '10',
        'http://127.0.0.1:21324/health',
      ],
      command: 'docker',
      commandRunner,
      cwd,
      env: commandEnvironment,
      statusId: PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.RUNTIME_HEALTH_FAILED,
    });

    runRequiredCommand({
      args: [
        ...composeArgs,
        'exec',
        '--no-TTY',
        'classifarr',
        'curl',
        '--fail',
        '--silent',
        '--show-error',
        '--output',
        '/dev/null',
        '--max-time',
        '10',
        'http://127.0.0.1:21324/api/system/health/ready',
      ],
      command: 'docker',
      commandRunner,
      cwd,
      env: commandEnvironment,
      statusId: PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.MIGRATION_READINESS_FAILED,
    });
  } catch (error) {
    failure = error;
  }

  if (composeMayNeedTeardown) {
    try {
      runRequiredCommand({
        args: [...composeArgs, 'down', '--volumes', '--remove-orphans'],
        command: 'docker',
        commandRunner,
        cwd,
        env: commandEnvironment,
        statusId: PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.TEARDOWN_FAILED,
      });
    } catch (cleanupError) {
      if (!failure) {
        failure = cleanupError;
      }
    }
  }

  if (failure) {
    throw failure;
  }

  const completedAt = now();
  if (!(completedAt instanceof Date) || Number.isNaN(completedAt.getTime())) {
    throwInvalidInput();
  }

  return createEvidence({
    completedAt: completedAt.toISOString(),
    image: publishedImage.image,
    sourceRevision: verifiedSourceRevision,
  });
}
