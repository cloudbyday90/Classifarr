/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EventEmitter } from 'node:events';
import path from 'node:path';
import { jest } from '@jest/globals';

import {
  runPolicyStorageClosureEvidenceCommand,
} from '../../services/policyStorageClosureEvidenceLauncherRunner.mjs';

function createChildProcess() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.kill = jest.fn(() => true);
  return child;
}

describe('policyStorageClosureEvidenceLauncherRunner', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('uses the Node executable, an argument array, and no shell', async () => {
    const child = createChildProcess();
    const spawnProcess = jest.fn(() => child);
    const resultPromise = runPolicyStorageClosureEvidenceCommand({
      cwd: path.join(process.cwd(), 'launcher-checkout'),
      scriptPath: 'scripts/example.mjs',
      args: ['--value', 'safe value'],
      timeoutMs: 1_000,
      spawnProcess,
    });

    child.emit('close', 0, null);

    await expect(resultPromise).resolves.toEqual({
      exitCode: 0,
      signal: null,
      timedOut: false,
    });
    expect(spawnProcess).toHaveBeenCalledWith(
      process.execPath,
      [path.join(process.cwd(), 'launcher-checkout', 'scripts', 'example.mjs'), '--value', 'safe value'],
      expect.objectContaining({
        cwd: path.join(process.cwd(), 'launcher-checkout'),
        shell: false,
        stdio: 'ignore',
        windowsHide: true,
      })
    );
  });

  test('escalates a timed-out command and returns without waiting indefinitely', async () => {
    jest.useFakeTimers();
    const child = createChildProcess();
    const resultPromise = runPolicyStorageClosureEvidenceCommand({
      cwd: process.cwd(),
      scriptPath: 'scripts/example.mjs',
      args: [],
      timeoutMs: 100,
      terminationGraceMs: 10,
      spawnProcess: () => child,
    });

    await jest.advanceTimersByTimeAsync(100);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    await jest.advanceTimersByTimeAsync(10);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');

    await jest.advanceTimersByTimeAsync(10);
    await expect(resultPromise).resolves.toEqual({
      exitCode: 1,
      signal: 'SIGKILL',
      timedOut: true,
    });
  });
});
