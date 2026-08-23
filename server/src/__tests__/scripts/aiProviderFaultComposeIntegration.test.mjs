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

import {
  AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS,
  AiProviderFaultComposeIntegrationError,
  createLoopbackStubBaseUrl,
  createAiProviderFaultComposeProjectName,
  DEFAULT_AI_PROVIDER_FAULT_COMPOSE_FILE,
  runAiProviderFaultComposeIntegration,
} from '../../../../scripts/lib/aiProviderFaultComposeIntegration.mjs';

function createRunner({ failedCommand = null } = {}) {
  const calls = [];
  const commandRunner = ({ command, args, cwd, env }) => {
    calls.push({ command, args, cwd, env });
    const composeCommand = args.find((value) => [
      'config',
      'down',
      'up',
    ].includes(value));
    const status = composeCommand === failedCommand || command === failedCommand ? 1 : 0;
    return {
      status,
      stdout: '',
    };
  };
  return { calls, commandRunner };
}

describe('aiProviderFaultComposeIntegration', () => {
  test('uses a fixed Compose target, passes only a loopback stub to Jest, and tears down', async () => {
    const { calls, commandRunner } = createRunner();

    const result = await runAiProviderFaultComposeIntegration({
      allocateLoopbackPortFn: async () => 45123,
      commandRunner,
      composeFile: DEFAULT_AI_PROVIDER_FAULT_COMPOSE_FILE,
      cwd: process.cwd(),
      nodePath: process.execPath,
      projectName: 'classifarr-ai-provider-fault-test-1234',
      waitTimeoutSeconds: 60,
    });

    expect(result).toEqual({
      projectName: 'classifarr-ai-provider-fault-test-1234',
      status: 'passed',
    });
    expect(calls.map(({ command, args }) => [command, args.at(-1)])).toEqual([
      ['docker', '--quiet'],
      ['docker', '--remove-orphans'],
      [process.execPath, '--testPathPatterns=ai-provider-fault-compose'],
      ['docker', '--remove-orphans'],
    ]);

    const testCall = calls.find(({ command }) => command === process.execPath);
    expect(testCall.env).toEqual(expect.objectContaining({
      CLASSIFARR_AI_PROVIDER_FAULT_COMPOSE: '1',
      CLASSIFARR_AI_PROVIDER_FAULT_PORT: '45123',
      CLASSIFARR_AI_PROVIDER_FAULT_STUB_BASE_URL: 'http://127.0.0.1:45123',
    }));
    expect(testCall.args).toContain('--testPathPatterns=ai-provider-fault-compose');

    const composeCalls = calls.filter(({ command }) => command === 'docker');
    for (const call of composeCalls) {
      expect(call.args).toContain(DEFAULT_AI_PROVIDER_FAULT_COMPOSE_FILE);
      expect(call.args).toContain('classifarr-ai-provider-fault-test-1234');
    }
  });

  test('tears down the isolated project when the targeted integration test fails', async () => {
    const { calls, commandRunner } = createRunner({ failedCommand: process.execPath });

    let thrownError;
    try {
      await runAiProviderFaultComposeIntegration({
        allocateLoopbackPortFn: async () => 45123,
        commandRunner,
        composeFile: DEFAULT_AI_PROVIDER_FAULT_COMPOSE_FILE,
        cwd: process.cwd(),
        nodePath: process.execPath,
        projectName: 'classifarr-ai-provider-fault-test-5678',
        waitTimeoutSeconds: 60,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toEqual(expect.objectContaining({
      statusId: AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.TEST_FAILED,
    }));
    expect(calls.at(-1).args).toEqual(expect.arrayContaining([
      'down',
      '--volumes',
      '--remove-orphans',
    ]));
  });

  test('rejects invalid loopback ports and arbitrary Compose files before startup', async () => {
    expect(() => createLoopbackStubBaseUrl(0)).toThrow(
      AiProviderFaultComposeIntegrationError,
    );
    await expect(runAiProviderFaultComposeIntegration({
      allocateLoopbackPortFn: async () => 45123,
      commandRunner: createRunner().commandRunner,
      composeFile: 'docker-compose.yml',
      cwd: process.cwd(),
      nodePath: process.execPath,
      projectName: 'classifarr-ai-provider-fault-test-9012',
      waitTimeoutSeconds: 60,
    })).rejects.toEqual(expect.objectContaining({
      statusId: AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.INVALID_INPUT,
    }));
  });

  test('fails closed when it cannot allocate a loopback port', async () => {
    await expect(runAiProviderFaultComposeIntegration({
      allocateLoopbackPortFn: async () => {
        throw new Error('port allocation failed');
      },
      commandRunner: createRunner().commandRunner,
      composeFile: DEFAULT_AI_PROVIDER_FAULT_COMPOSE_FILE,
      cwd: process.cwd(),
      nodePath: process.execPath,
      projectName: 'classifarr-ai-provider-fault-test-3456',
      waitTimeoutSeconds: 60,
    })).rejects.toEqual(expect.objectContaining({
      statusId: AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.LOOPBACK_PORT_FAILED,
    }));
  });

  test('generates a constrained, unique project name', () => {
    const projectName = createAiProviderFaultComposeProjectName({
      processId: 9876,
      randomBytesFn: () => Buffer.from('1a2b3c4d', 'hex'),
    });

    expect(projectName).toBe('classifarr-ai-provider-fault-9876-1a2b3c4d');
  });
});
