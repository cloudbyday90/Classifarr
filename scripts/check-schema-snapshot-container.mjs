#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { checkSchemaSnapshot } from './check-schema-snapshot.mjs';
import { dumpSchema } from './dump-schema.mjs';
import { runDockerCheckCommand } from './lib/dockerCheckCommand.mjs';
import { waitForContainerReady } from './lib/containerReadiness.mjs';
import { collectContainerStartupDiagnostic, formatContainerStartupDiagnostic } from './lib/containerStartupDiagnostics.mjs';

export const DEFAULT_IMAGE_NAME = process.env.IMAGE_NAME || 'classifarr:test';
export const SCHEMA_CHECK_CONTAINER_LABEL = 'io.classifarr.role=schema-snapshot-check';
const TEMP_ROOT = resolve(import.meta.dirname, '../.tmp');

export function createSchemaCheckRunSpec({
  prefix = 'classifarr-schema-check',
  suffix = randomUUID(),
  tempRoot = TEMP_ROOT,
} = {}) {
  const normalizedSuffix = String(suffix).replace(/[^a-zA-Z0-9_.-]/g, '-');
  return {
    containerName: `${prefix}-${normalizedSuffix}`,
    hostDataPath: join(tempRoot, `${prefix}-data-${normalizedSuffix}`),
  };
}

export function buildDockerBindMountArg(hostPath, containerPath = '/app/data') {
  return `type=bind,src=${resolve(hostPath)},dst=${containerPath}`;
}

function getHostUid() {
  return typeof process.getuid === 'function' ? String(process.getuid()) : null;
}

function getHostGid() {
  return typeof process.getgid === 'function' ? String(process.getgid()) : null;
}

export function buildSchemaCheckIdentityEnvArgs({
  uid = getHostUid(),
  gid = getHostGid(),
} = {}) {
  if (!uid || !gid) {
    return [];
  }

  return ['-e', `PUID=${uid}`, '-e', `PGID=${gid}`];
}

function ensureRemovedHostData(hostDataPath) {
  fs.rmSync(hostDataPath, { recursive: true, force: true });
}

function ensureRemovedHostDataWithContainer(hostDataPath, imageName, command) {
  const result = command([
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    '--mount',
    buildDockerBindMountArg(hostDataPath, '/cleanup'),
    imageName,
    '-lc',
    'rm -rf /cleanup/* /cleanup/.[!.]* /cleanup/..?*'
  ], { timeoutMs: 30_000 });
  if (!result.ok) throw new Error('schema_check_data_cleanup_failed');
  fs.rmSync(hostDataPath, { recursive: true, force: true });
}

function ensureRemovedHostDataRobust(hostDataPath, imageName, command) {
  try {
    ensureRemovedHostData(hostDataPath);
  } catch (error) {
    if (error?.code !== 'EACCES' && error?.code !== 'EPERM') {
      throw error;
    }
    ensureRemovedHostDataWithContainer(hostDataPath, imageName, command);
  }
}

function startSchemaCheckContainer({ containerName, hostDataPath, imageName, command }) {
  const hostUid = getHostUid();
  const hostGid = getHostGid();
  const dockerArgs = [
    'run',
    '-d',
    '--name',
    containerName,
    '--label',
    SCHEMA_CHECK_CONTAINER_LABEL,
    '--mount',
    buildDockerBindMountArg(hostDataPath),
  ];
  dockerArgs.push(...buildSchemaCheckIdentityEnvArgs({ uid: hostUid, gid: hostGid }));
  if (!command([...dockerArgs, imageName], { timeoutMs: 120_000 }).ok) {
    throw new Error('Container creation failed.\n' +
      formatContainerStartupDiagnostic(collectContainerStartupDiagnostic(containerName, { command })));
  }
}

function registerSignalCleanup(cleanup) {
  const handlers = [
    ['SIGINT', () => {
      cleanup();
      process.exit(130);
    }],
    ['SIGTERM', () => {
      cleanup();
      process.exit(143);
    }],
  ];

  for (const [signal, handler] of handlers) {
    process.once(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      process.removeListener(signal, handler);
    }
  };
}

export async function withSchemaCheckContainer({
  imageName = DEFAULT_IMAGE_NAME,
  runSpec = createSchemaCheckRunSpec(),
  action,
  command = runDockerCheckCommand,
} = {}) {
  const { containerName, hostDataPath } = runSpec;
  // Only this repository's disposable directory, never an arbitrary supplied bind mount.
  if (!/^classifarr-schema-check-[a-zA-Z0-9_.-]+$/.test(containerName) ||
    dirname(resolve(hostDataPath)) !== TEMP_ROOT ||
    basename(hostDataPath) !== containerName.replace('classifarr-schema-check-', 'classifarr-schema-check-data-')) {
    throw new Error('invalid_schema_check_target');
  }
  const existing = command(['ps', '-aq', '--filter', `name=^${containerName}$`]);
  if (!existing.ok || existing.stdout.trim() || fs.existsSync(hostDataPath)) throw new Error('schema_check_target_not_empty');
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  fs.mkdirSync(hostDataPath);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    const removed = command(['rm', '-f', containerName], { timeoutMs: 30_000 });
    if (!removed.ok) {
      const remaining = command(['ps', '-aq', '--filter', `name=^${containerName}$`]);
      if (!remaining.ok || remaining.stdout.trim()) throw new Error('schema_check_container_cleanup_failed');
    }
    ensureRemovedHostDataRobust(hostDataPath, imageName, command);
    cleaned = true;
  };
  const unregisterSignalCleanup = registerSignalCleanup(cleanup);
  let failure;
  try {
    startSchemaCheckContainer({ containerName, hostDataPath, imageName, command });
    await waitForContainerReady(containerName, { command });

    const previousDumpContainer = process.env.DUMP_CONTAINER;
    process.env.DUMP_CONTAINER = containerName;

    try {
      await action();
    } finally {
      if (previousDumpContainer == null) {
        delete process.env.DUMP_CONTAINER;
      } else {
        process.env.DUMP_CONTAINER = previousDumpContainer;
      }
    }
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    unregisterSignalCleanup();
    try { cleanup(); }
    catch (error) {
      if (failure) {
        // Preserve the startup diagnosis even if Docker becomes unavailable during cleanup.
        throw new Error(`${failure.message}\nOwned resource cleanup also failed; inspect the disposable schema-check resources.`,
          { cause: error });
      }
      throw error;
    }
  }
}

export async function checkSchemaSnapshotWithContainer(options = {}) {
  return withSchemaCheckContainer({
    ...options,
    action: () => checkSchemaSnapshot(),
  });
}

export async function dumpSchemaWithContainer(options = {}) {
  return withSchemaCheckContainer({
    ...options,
    action: () => dumpSchema(),
  });
}

async function main() {
  try {
    const mode = process.argv.includes('--dump') ? 'dump' : 'check';

    if (mode === 'dump') {
      await dumpSchemaWithContainer();
      console.log('✅ Schema snapshot container dump passed and cleaned up.');
      return;
    }

    await checkSchemaSnapshotWithContainer();
    console.log('✅ Schema snapshot container check passed and cleaned up.');
  } catch (error) {
    const mode = process.argv.includes('--dump') ? 'dump' : 'check';
    console.error(`❌ Schema snapshot container ${mode} failed:`, error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
