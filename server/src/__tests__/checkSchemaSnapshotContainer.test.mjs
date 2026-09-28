/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import { isAbsolute, normalize } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { jest } from '@jest/globals';

import {
  buildDockerBindMountArg,
  buildSchemaCheckIdentityEnvArgs,
  createSchemaCheckRunSpec,
  SCHEMA_CHECK_CONTAINER_LABEL,
  withSchemaCheckContainer,
} from '../../../scripts/check-schema-snapshot-container.mjs';

describe('schema snapshot container helpers', () => {
  test('creates unique container/data paths for schema checks', () => {
    const runSpec = createSchemaCheckRunSpec({
      prefix: 'classifarr-schema-check',
      suffix: 'run 1',
      tempRoot: '/tmp/classifarr',
    });

    expect(runSpec.containerName).toBe('classifarr-schema-check-run-1');
    expect(normalize(runSpec.hostDataPath)).toBe(
      normalize('/tmp/classifarr/classifarr-schema-check-data-run-1')
    );
  });

  test('builds docker bind-mount args without shell-style colon interpolation', () => {
    const defaultMountArg = buildDockerBindMountArg('/tmp/schema-check');
    const customMountArg = buildDockerBindMountArg('/tmp/schema-check', '/custom/data');

    expect(defaultMountArg).toContain('type=bind,src=');
    expect(defaultMountArg).toContain(',dst=/app/data');
    expect(defaultMountArg).not.toContain(':/app/data');
    expect(customMountArg).toContain(',dst=/custom/data');
    expect(isAbsolute(defaultMountArg.split('src=')[1].split(',dst=')[0])).toBe(true);
  });

  test('labels schema-check containers without purging other verification runs', () => {
    expect(SCHEMA_CHECK_CONTAINER_LABEL).toBe('io.classifarr.role=schema-snapshot-check');
  });

  test('passes host uid/gid into the verification container when available', () => {
    expect(buildSchemaCheckIdentityEnvArgs({ uid: '1000', gid: '1001' })).toEqual([
      '-e',
      'PUID=1000',
      '-e',
      'PGID=1001',
    ]);
    expect(buildSchemaCheckIdentityEnvArgs({ uid: null, gid: '1001' })).toEqual([]);
  });
});

function commandFixture({ exit = false, creationFailure = false } = {}) {
  return jest.fn(args => ({ ok: !(creationFailure && args[0] === 'run'), stderr: '',
    stdout: args[0] === 'inspect' ? JSON.stringify({ status: exit ? 'exited' : 'running',
      exitCode: exit ? 1 : 0, oomKilled: false, errorPresent: false, health: 'none' })
      : args[0] === 'exec' ? '200' : args[0] === 'logs' ? 'Failed to start server: Restore verification is incomplete.' : '' }));
}

test.each([false, true])('schema runner cleans only owned resources; early exit=%s', async exit => {
  const runSpec = createSchemaCheckRunSpec();
  const command = commandFixture({ exit });
  const action = jest.fn(() => { expect(process.env.DUMP_CONTAINER).toBe(runSpec.containerName); });
  const previous = process.env.DUMP_CONTAINER;
  const result = withSchemaCheckContainer({ runSpec, command, action });
  if (exit) await expect(result).rejects.toThrow('restore_verification_incomplete');
  else await result;
  expect(action).toHaveBeenCalledTimes(exit ? 0 : 1);
  expect(existsSync(runSpec.hostDataPath)).toBe(false);
  expect(process.env.DUMP_CONTAINER).toBe(previous);
  expect(command.mock.calls.filter(([args]) => args[0] === 'rm').map(([args]) => args))
    .toEqual([['rm', '-f', runSpec.containerName]]);
  expect(command.mock.calls.some(([args]) => args.some(arg => arg.startsWith('label=')))).toBe(false);
  if (exit) expect(command.mock.calls.findIndex(([args]) => args[0] === 'logs'))
    .toBeLessThan(command.mock.calls.findIndex(([args]) => args[0] === 'rm'));
});

test('schema runner refuses colliding names and paths outside its scratch directory', async () => {
  const command = jest.fn(() => ({ ok: true, stdout: 'existing' }));
  await expect(withSchemaCheckContainer({ command, action: jest.fn() })).rejects.toThrow('target_not_empty');
  expect(command).toHaveBeenCalledTimes(1);
  command.mockClear();
  await expect(withSchemaCheckContainer({ command, runSpec: { containerName: 'classifarr', hostDataPath: '.' } }))
    .rejects.toThrow('invalid_schema_check_target');
  expect(command).not.toHaveBeenCalled();
});

test('creation failure gathers diagnosis and cleans without running schema action', async () => {
  const runSpec = createSchemaCheckRunSpec();
  const command = commandFixture({ creationFailure: true });
  const action = jest.fn();
  await expect(withSchemaCheckContainer({ runSpec, command, action })).rejects.toThrow('Container creation failed');
  expect(action).not.toHaveBeenCalled();
  expect(existsSync(runSpec.hostDataPath)).toBe(false);
});

test('action failures still restore the dump environment and remove owned resources', async () => {
  const runSpec = createSchemaCheckRunSpec();
  const previous = process.env.DUMP_CONTAINER;
  await expect(withSchemaCheckContainer({ runSpec, command: commandFixture(), action: async () => {
    throw new Error('schema_comparison_failed');
  } })).rejects.toThrow('schema_comparison_failed');
  expect(process.env.DUMP_CONTAINER).toBe(previous);
  expect(existsSync(runSpec.hostDataPath)).toBe(false);
});

test('cleanup outage preserves the original diagnosis and does not delete possibly mounted data', async () => {
  const runSpec = createSchemaCheckRunSpec();
  const inner = commandFixture({ exit: true });
  let cleanupAttempted = false;
  const command = args => {
    if (args[0] === 'rm') { cleanupAttempted = true; return { ok: false }; }
    if (cleanupAttempted && args[0] === 'ps') return { ok: false };
    return inner(args);
  };
  try {
    await expect(withSchemaCheckContainer({ runSpec, command, action: jest.fn() }))
      .rejects.toThrow(/restore_verification_incomplete[\s\S]*cleanup also failed/);
    expect(existsSync(runSpec.hostDataPath)).toBe(true);
  } finally {
    // The mocked runner created only this exact scratch directory, never a container.
    rmSync(runSpec.hostDataPath, { recursive: true, force: true });
  }
});
