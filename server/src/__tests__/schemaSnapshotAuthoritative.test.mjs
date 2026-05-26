/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import {
  buildSchemaAuthorityContainerOptions,
  buildSchemaAuthorityDockerBuildArgs,
  parseSchemaSnapshotAuthorityArgs,
  runAuthoritativeSchemaSnapshot,
} from '../../../scripts/schema-snapshot-authoritative.mjs';

describe('schema-snapshot-authoritative tooling', () => {
  test('parses dump and skip-build flags', () => {
    expect(parseSchemaSnapshotAuthorityArgs(['--dump', '--skip-build'])).toEqual({
      mode: 'dump',
      skipBuild: true,
    });
    expect(parseSchemaSnapshotAuthorityArgs([])).toEqual({
      mode: 'check',
      skipBuild: false,
    });
  });

  test('builds the local Docker image from the current repo context', () => {
    expect(buildSchemaAuthorityDockerBuildArgs({ imageName: 'classifarr:test' })).toEqual([
      'build',
      '-t',
      'classifarr:test',
      '.',
    ]);
  });

  test('uses the default fresh-install container options for installability checks', () => {
    expect(buildSchemaAuthorityContainerOptions({ imageName: 'classifarr:test' })).toEqual({
      imageName: 'classifarr:test',
    });
  });

  test('runs the live dump path, then canonicalizes through a fresh-install container', async () => {
    const execCalls = [];
    const dumpCalls = [];
    const containerDumpCalls = [];

    await runAuthoritativeSchemaSnapshot({
      mode: 'dump',
      skipBuild: true,
      imageName: 'classifarr:test',
      execFileSyncImpl: (command, args) => {
        execCalls.push([command, args]);
        return '';
      },
      dumpSchemaFn: options => {
        dumpCalls.push(options);
      },
      verifySourceDatabaseCurrentFn: () => {
        throw new Error('should not run migration verification path');
      },
      dumpSchemaWithContainerFn: async options => {
        containerDumpCalls.push(options);
      },
      checkSchemaSnapshotWithContainerFn: async () => {
        throw new Error('should not run container check path');
      },
      log: { log: () => {} },
    });

    expect(execCalls).toEqual([]);
    expect(dumpCalls).toHaveLength(1);
    expect(containerDumpCalls).toEqual([{ imageName: 'classifarr:test' }]);
  });

  test('verifies live migration state, then validates a fresh install in Docker', async () => {
    const checkCalls = [];
    const execCalls = [];
    const liveVerificationCalls = [];

    await runAuthoritativeSchemaSnapshot({
      mode: 'check',
      skipBuild: true,
      imageName: 'classifarr:test',
      execFileSyncImpl: (command, args) => {
        execCalls.push([command, args]);
        return '';
      },
      dumpSchemaFn: () => {
        throw new Error('should not run dump path');
      },
      verifySourceDatabaseCurrentFn: options => {
        liveVerificationCalls.push(options);
      },
      dumpSchemaWithContainerFn: async () => {
        throw new Error('should not run container dump path');
      },
      checkSchemaSnapshotWithContainerFn: async (options) => {
        checkCalls.push(options);
      },
      log: { log: () => {} },
    });

    expect(execCalls).toEqual([]);
    expect(liveVerificationCalls).toHaveLength(1);
    expect(checkCalls).toEqual([
      {
        imageName: 'classifarr:test',
      },
    ]);
  });
});
