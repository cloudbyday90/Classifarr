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

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { checkSchemaSnapshot } from './check-schema-snapshot.mjs';
import { dumpSchema } from './dump-schema.mjs';

const DEFAULT_IMAGE_NAME = process.env.IMAGE_NAME || 'classifarr:test';
const READY_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 2_000;
export const SCHEMA_CHECK_CONTAINER_LABEL = 'io.classifarr.role=schema-snapshot-check';

function sleep(milliseconds) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}

function runCommand(command, args, { allowFailure = false, encoding = 'utf8' } = {}) {
  try {
    const stdout = execFileSync(command, args, {
      encoding,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout: String(stdout || '') };
  } catch (error) {
    if (!allowFailure) {
      throw error;
    }
    return {
      ok: false,
      stdout: String(error?.stdout || ''),
      stderr: String(error?.stderr || ''),
      error,
    };
  }
}

function docker(...args) {
  return runCommand('docker', args);
}

function dockerAllowFailure(...args) {
  return runCommand('docker', args, { allowFailure: true });
}

function parseContainerIds(stdout) {
  return String(stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

export function createSchemaCheckRunSpec({
  prefix = 'classifarr-schema-check',
  suffix = `${Date.now()}-${process.pid}`,
  tempRoot = join(process.cwd(), '.tmp'),
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

export function buildSchemaCheckContainerLabelFilter() {
  return `label=${SCHEMA_CHECK_CONTAINER_LABEL}`;
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

function ensureRemovedContainer(containerName) {
  dockerAllowFailure('rm', '-f', containerName);
}

function ensureRemovedSchemaCheckContainers() {
  const containers = parseContainerIds(
    dockerAllowFailure('ps', '-aq', '--filter', buildSchemaCheckContainerLabelFilter()).stdout
  );

  if (containers.length > 0) {
    dockerAllowFailure('rm', '-f', ...containers);
  }
}

function ensureRemovedHostData(hostDataPath) {
  try {
    fs.rmSync(hostDataPath, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== 'EACCES' && error?.code !== 'EPERM') {
      throw error;
    }
    throw error;
  }
}

function ensureRemovedHostDataWithContainer(hostDataPath, imageName) {
  dockerAllowFailure(
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    '--mount',
    buildDockerBindMountArg(hostDataPath, '/cleanup'),
    imageName,
    '-lc',
    'rm -rf /cleanup/* /cleanup/.[!.]* /cleanup/..?* 2>/dev/null || true'
  );
  fs.rmSync(hostDataPath, { recursive: true, force: true });
}

function ensureRemovedHostDataRobust(hostDataPath, imageName) {
  try {
    ensureRemovedHostData(hostDataPath);
  } catch (error) {
    if (error?.code !== 'EACCES' && error?.code !== 'EPERM') {
      throw error;
    }
    ensureRemovedHostDataWithContainer(hostDataPath, imageName);
  }
}

function startSchemaCheckContainer({ containerName, hostDataPath, imageName }) {
  fs.mkdirSync(hostDataPath, { recursive: true });
  ensureRemovedContainer(containerName);
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
  docker(...dockerArgs, imageName);
}

function getContainerLogs(containerName) {
  return docker('logs', containerName).stdout;
}

async function waitForContainerReady(containerName, timeoutMs = READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const appReady = dockerAllowFailure(
      'exec',
      containerName,
      'curl',
      '-fsS',
      'http://127.0.0.1:21324/health'
    );

    if (appReady.ok) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const logs = getContainerLogs(containerName);
  throw new Error(`Container ${containerName} did not become application-ready in time.\n${logs}`);
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

async function withSchemaCheckContainer({
  imageName = DEFAULT_IMAGE_NAME,
  runSpec = createSchemaCheckRunSpec(),
  action,
} = {}) {
  const { containerName, hostDataPath } = runSpec;
  const cleanup = () => {
    ensureRemovedContainer(containerName);
    ensureRemovedHostDataRobust(hostDataPath, imageName);
    ensureRemovedSchemaCheckContainers();
  };
  const unregisterSignalCleanup = registerSignalCleanup(cleanup);

  try {
    ensureRemovedSchemaCheckContainers();
    ensureRemovedContainer(containerName);
    ensureRemovedHostDataRobust(hostDataPath, imageName);
    startSchemaCheckContainer({ containerName, hostDataPath, imageName });
    await waitForContainerReady(containerName);

    const previousDumpContainer = process.env.DUMP_CONTAINER;
    process.env.DUMP_CONTAINER = containerName;

    try {
      action();
    } finally {
      if (previousDumpContainer == null) {
        delete process.env.DUMP_CONTAINER;
      } else {
        process.env.DUMP_CONTAINER = previousDumpContainer;
      }
    }
  } finally {
    unregisterSignalCleanup();
    cleanup();
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
