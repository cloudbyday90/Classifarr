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

import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';
import { resolve } from 'node:path';

export const AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS = Object.freeze({
  COMPOSE_CONFIGURATION_FAILED: 'compose_configuration_failed',
  COMPOSE_START_FAILED: 'compose_start_failed',
  INVALID_INPUT: 'invalid_input',
  LOOPBACK_PORT_FAILED: 'loopback_port_failed',
  TEARDOWN_FAILED: 'teardown_failed',
  TEST_FAILED: 'test_failed',
});

export const DEFAULT_AI_PROVIDER_FAULT_COMPOSE_FILE = resolve(
  import.meta.dirname,
  '../../docker-compose.ai-provider-fault-integration.yml',
);
export const DEFAULT_AI_PROVIDER_FAULT_WAIT_TIMEOUT_SECONDS = 60;

const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u;
const LOOPBACK_HOST = '127.0.0.1';

export class AiProviderFaultComposeIntegrationError extends Error {
  constructor(statusId) {
    super(`AI provider fault Compose integration failed: ${statusId}.`);
    this.name = 'AiProviderFaultComposeIntegrationError';
    this.statusId = statusId;
  }
}

function createSystemCommandRunner() {
  return ({ command, args, cwd, env }) => spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  });
}

function throwInvalidInput() {
  throw new AiProviderFaultComposeIntegrationError(
    AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.INVALID_INPUT,
  );
}

function assertProjectName(projectName) {
  if (typeof projectName !== 'string' || !PROJECT_NAME_PATTERN.test(projectName)) {
    throwInvalidInput();
  }
}

function assertWaitTimeout(waitTimeoutSeconds) {
  if (
    !Number.isSafeInteger(waitTimeoutSeconds)
    || waitTimeoutSeconds < 30
    || waitTimeoutSeconds > 300
  ) {
    throwInvalidInput();
  }
}

function assertComposeFile(composeFile) {
  if (resolve(composeFile) !== DEFAULT_AI_PROVIDER_FAULT_COMPOSE_FILE) {
    throwInvalidInput();
  }
}

function runRequiredCommand({ command, args, commandRunner, cwd, env, statusId }) {
  let result;
  try {
    result = commandRunner({ command, args, cwd, env });
  } catch (_error) {
    throw new AiProviderFaultComposeIntegrationError(statusId);
  }

  if (result?.status !== 0) {
    throw new AiProviderFaultComposeIntegrationError(statusId);
  }
  return result;
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

export function createAiProviderFaultComposeProjectName({
  processId = process.pid,
  randomBytesFn = randomBytes,
} = {}) {
  const normalizedProcessId = Number.parseInt(String(processId), 10);
  const suffix = randomBytesFn(4).toString('hex');

  if (
    !Number.isSafeInteger(normalizedProcessId)
    || normalizedProcessId < 1
    || !/^[a-f0-9]{8}$/u.test(suffix)
  ) {
    throwInvalidInput();
  }

  return `classifarr-ai-provider-fault-${normalizedProcessId}-${suffix}`;
}

/**
 * Builds the only endpoint that the integration test may reach. Restricting it
 * to loopback prevents a compromised environment from redirecting the test to
 * a real provider or a remote host.
 */
export function createLoopbackStubBaseUrl(port) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throwInvalidInput();
  }

  return `http://${LOOPBACK_HOST}:${port}`;
}

/**
 * Ask the host OS for a currently free loopback port. The listening socket is
 * released immediately before Compose starts, so Compose remains the only
 * process that can own the endpoint. A collision is still handled safely by a
 * failed bounded Compose startup rather than by falling back to another host.
 */
export async function allocateLoopbackPort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', rejectPort);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
          rejectPort(error || new Error('Loopback port allocation returned an invalid port'));
          return;
        }
        resolvePort(port);
      });
    });
  });
}

function createIntegrationTestCommand({ cwd, nodePath }) {
  return {
    command: nodePath,
    args: [
      resolve(cwd, 'scripts', 'run-jest.mjs'),
      '-c',
      resolve(cwd, 'server', 'jest.integration.config.mjs'),
      '--runInBand',
      '--testPathPatterns=ai-provider-fault-compose',
    ],
  };
}

/**
 * Starts only the fixed test-only provider stub, runs the targeted integration
 * suite, and always tears down the uniquely named Compose project. It never
 * accepts a normal Compose file, endpoint, image, or arbitrary command.
 */
export async function runAiProviderFaultComposeIntegration({
  allocateLoopbackPortFn = allocateLoopbackPort,
  commandRunner = createSystemCommandRunner(),
  composeFile = DEFAULT_AI_PROVIDER_FAULT_COMPOSE_FILE,
  cwd = process.cwd(),
  nodePath = process.execPath,
  projectName = createAiProviderFaultComposeProjectName(),
  waitTimeoutSeconds = DEFAULT_AI_PROVIDER_FAULT_WAIT_TIMEOUT_SECONDS,
} = {}) {
  if (typeof cwd !== 'string' || cwd.length === 0 || typeof nodePath !== 'string' || nodePath.length === 0) {
    throwInvalidInput();
  }
  assertComposeFile(composeFile);
  assertProjectName(projectName);
  assertWaitTimeout(waitTimeoutSeconds);

  let loopbackPort;
  try {
    loopbackPort = await allocateLoopbackPortFn();
  } catch (_error) {
    throw new AiProviderFaultComposeIntegrationError(
      AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.LOOPBACK_PORT_FAILED,
    );
  }
  const stubBaseUrl = createLoopbackStubBaseUrl(loopbackPort);
  const composeArgs = createComposeArgs({ composeFile, cwd, projectName });
  const commandEnvironment = {
    CLASSIFARR_AI_PROVIDER_FAULT_COMPOSE: '1',
    CLASSIFARR_AI_PROVIDER_FAULT_PORT: String(loopbackPort),
  };
  let composeMayNeedTeardown = false;
  let failure = null;

  try {
    runRequiredCommand({
      command: 'docker',
      args: [...composeArgs, 'config', '--quiet'],
      commandRunner,
      cwd,
      env: commandEnvironment,
      statusId: AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.COMPOSE_CONFIGURATION_FAILED,
    });

    composeMayNeedTeardown = true;
    runRequiredCommand({
      command: 'docker',
      args: [
        ...composeArgs,
        'up',
        '--detach',
        '--wait',
        '--wait-timeout',
        String(waitTimeoutSeconds),
        '--build',
        '--remove-orphans',
      ],
      commandRunner,
      cwd,
      env: commandEnvironment,
      statusId: AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.COMPOSE_START_FAILED,
    });

    const testCommand = createIntegrationTestCommand({ cwd, nodePath });

    runRequiredCommand({
      command: testCommand.command,
      args: testCommand.args,
      commandRunner,
      cwd,
      env: {
        ...commandEnvironment,
        CLASSIFARR_AI_PROVIDER_FAULT_STUB_BASE_URL: stubBaseUrl,
      },
      statusId: AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.TEST_FAILED,
    });
  } catch (error) {
    failure = error;
  }

  if (composeMayNeedTeardown) {
    try {
      runRequiredCommand({
        command: 'docker',
        args: [...composeArgs, 'down', '--volumes', '--remove-orphans'],
        commandRunner,
        cwd,
        env: commandEnvironment,
        statusId: AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.TEARDOWN_FAILED,
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

  return {
    projectName,
    status: 'passed',
  };
}
