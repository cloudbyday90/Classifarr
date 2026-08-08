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
import { resolve } from 'node:path';

const DEFAULT_IMAGE_NAME = process.env.IMAGE_NAME || 'classifarr:test';
const PGVECTOR_PREVIOUS_VERSION = '0.8.2';
const PGVECTOR_TARGET_VERSION = '0.8.6';
const PGVECTOR_PREVIOUS_PG17_IMAGE = `pgvector/pgvector:${PGVECTOR_PREVIOUS_VERSION}-pg17`;
const READY_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 2_000;

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

export function buildPgStatStatementsRuntimeRemovalCommand() {
  return [
    'set -eu',
    'PG_CONFIG="$(command -v pg_config || true)"',
    'if [ -z "$PG_CONFIG" ]; then PG_CONFIG="$(find /usr/libexec -path \'*/pg_config\' | sort | tail -n 1)"; fi',
    'if [ -z "$PG_CONFIG" ]; then echo "Could not locate pg_config inside the container." >&2; exit 1; fi',
    'PKGLIBDIR="$($PG_CONFIG --pkglibdir)"',
    'SHAREDIR="$($PG_CONFIG --sharedir)"',
    'rm -f "$PKGLIBDIR/pg_stat_statements.so"',
    'rm -f "$SHAREDIR/extension/pg_stat_statements.control"',
    'exec /app/docker-entrypoint.sh',
  ].join('; ');
}

export function buildPg17UpgradeCarryoverPreparationCommand() {
  return [
    'set -eu',
    'psql -U classifarr -d classifarr --set ON_ERROR_STOP=1 -c "CREATE EXTENSION vector VERSION \'0.8.2\'"',
    'printf "dynamic_library_path = \'/run/postgresql/pgvector, \\$libdir\'\\n" >> "$PGDATA/postgresql.auto.conf"',
  ].join('; ');
}

export function buildIncludedConfigFailurePreparationCommand() {
  return [
    'set -eu',
    'PG_CONFIG="$(command -v pg_config || true)"',
    'if [ -z "$PG_CONFIG" ]; then PG_CONFIG="$(find /usr/libexec -path \'*/pg_config\' | sort | tail -n 1)"; fi',
    'mkdir -p /app/data/postgres /run/postgresql',
    'chown -R classifarr:classifarr /app/data /run/postgresql',
    'su-exec classifarr initdb -D /app/data/postgres --auth=trust --encoding=UTF8',
    'echo "listen_addresses = \'localhost\'" >> /app/data/postgres/postgresql.conf',
    'echo "unix_socket_directories = \'/run/postgresql\'" >> /app/data/postgres/postgresql.conf',
    'mkdir -p /app/data/postgres/conf.d',
    'echo "include_dir \'conf.d\'" >> /app/data/postgres/postgresql.auto.conf',
    'printf "dynamic_library_path = \'/run/postgresql/pgvector, \\$libdir\'\\n" > /app/data/postgres/conf.d/bad-library-path.conf',
  ].join('; ');
}

export function hasPgStatStatementsFatalStartup(logs) {
  return /FATAL:\s+could not access file "pg_stat_statements"/.test(logs);
}

export function hasPgStatStatementsMissingRuntimeWarning(logs) {
  return logs.includes('pg_stat_statements runtime files are missing for this PostgreSQL image');
}

export function hasPostgres17To18UpgradeLog(logs) {
  return logs.includes('Auto-upgrading PostgreSQL 17 -> 18 (pg_upgrade)');
}

export function hasPostgresIncludeDirectiveDiagnostics(logs, label, directive, target) {
  return (
    logs.includes(`PostgreSQL include directives detected in ${label}:`) &&
    logs.includes(`${directive} '${target}'`)
  );
}

function docker(...args) {
  return runCommand('docker', args);
}

function dockerAllowFailure(...args) {
  return runCommand('docker', args, { allowFailure: true });
}

function dockerSh(containerName, shellCommand) {
  return docker('exec', containerName, 'sh', '-lc', shellCommand).stdout;
}

function getContainerStatus(containerName) {
  return docker('inspect', '-f', '{{.State.Status}}', containerName).stdout.trim();
}

function ensureRemovedContainer(containerName) {
  dockerAllowFailure('rm', '-f', containerName);
}

function ensureRemovedVolume(volumeName) {
  dockerAllowFailure('volume', 'rm', '-f', volumeName);
}

function createVolume(volumeName) {
  docker('volume', 'create', volumeName);
}

function prepareVolumeWithCommand({ volumeName, imageName, shellCommand }) {
  docker(
    'run',
    '--rm',
    '-v',
    `${volumeName}:/app/data`,
    '--entrypoint',
    '/bin/sh',
    imageName,
    '-lc',
    shellCommand
  );
}

function startSmokeContainer({ containerName, volumeName, imageName, stripPgssRuntime }) {
  ensureRemovedContainer(containerName);
  const args = [
    'run',
    '-d',
    '--name',
    containerName,
    '-v',
    `${volumeName}:/app/data`,
  ];

  if (stripPgssRuntime) {
    args.push('--entrypoint', '/bin/sh', imageName, '-lc', buildPgStatStatementsRuntimeRemovalCommand());
  } else {
    args.push(imageName);
  }

  docker(...args);
}

function startPreviousPgvectorContainer({ containerName, volumeName }) {
  ensureRemovedContainer(containerName);
  docker(
    'run',
    '-d',
    '--name',
    containerName,
    '-e',
    'POSTGRES_DB=classifarr',
    '-e',
    'POSTGRES_USER=classifarr',
    '-e',
    'POSTGRES_PASSWORD=classifarr',
    '-e',
    'PGDATA=/app/data/postgres',
    '-v',
    `${volumeName}:/app/data`,
    PGVECTOR_PREVIOUS_PG17_IMAGE,
  );
}

function getContainerLogs(containerName) {
  return docker('logs', containerName).stdout;
}

function getPsqlValue(containerName, sql) {
  return docker(
    'exec',
    containerName,
    'psql',
    '-U',
    'classifarr',
    '-d',
    'classifarr',
    '-tA',
    '-c',
    sql
  ).stdout.trim();
}

function getFileContents(containerName, filePath) {
  return dockerSh(containerName, `cat ${filePath}`);
}

export function createSmokeRunNames(prefix = 'classifarr-pgss-smoke', suffix = `${Date.now()}-${process.pid}`) {
  const normalizedSuffix = String(suffix).replace(/[^a-zA-Z0-9_.-]/g, '-');
  return {
    freshVolume: `${prefix}-fresh-${normalizedSuffix}`,
    existingVolume: `${prefix}-existing-${normalizedSuffix}`,
    upgradeVolume: `${prefix}-upgrade-${normalizedSuffix}`,
    includeVolume: `${prefix}-include-${normalizedSuffix}`,
    freshContainer: `${prefix}-fresh-${normalizedSuffix}`,
    baselineContainer: `${prefix}-existing-base-${normalizedSuffix}`,
    recoveryContainer: `${prefix}-existing-recovery-${normalizedSuffix}`,
    upgradeSeedContainer: `${prefix}-upgrade-seed-${normalizedSuffix}`,
    upgradeContainer: `${prefix}-upgrade-${normalizedSuffix}`,
    includeContainer: `${prefix}-include-${normalizedSuffix}`,
  };
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForContainerReady(containerName, timeoutMs = READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const pgReady = dockerAllowFailure('exec', containerName, 'pg_isready', '-q');
    const appReady = dockerAllowFailure(
      'exec',
      containerName,
      'curl',
      '-fsS',
      'http://127.0.0.1:21324/health'
    );

    if (pgReady.ok && appReady.ok) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const logs = getContainerLogs(containerName);
  throw new Error(`Container ${containerName} did not become ready in time.\n${logs}`);
}

async function waitForPostgresReady(containerName, timeoutMs = READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const pgReady = dockerAllowFailure(
      'exec',
      containerName,
      'pg_isready',
      '-U',
      'classifarr',
      '-d',
      'classifarr',
      '-q',
    );
    if (pgReady.ok) {
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const logs = getContainerLogs(containerName);
  throw new Error(`Container ${containerName} did not expose PostgreSQL in time.\n${logs}`);
}

async function waitForContainerExit(containerName, timeoutMs = READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = getContainerStatus(containerName);
    if (status === 'exited' || status === 'dead') {
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const logs = getContainerLogs(containerName);
  throw new Error(`Container ${containerName} did not exit in time.\n${logs}`);
}

async function runFreshInstallSmoke({ imageName, volumeName, containerName }) {
  console.log('SMOKE: fresh install with missing pg_stat_statements runtime files');
  createVolume(volumeName);
  startSmokeContainer({
    containerName,
    volumeName,
    imageName,
    stripPgssRuntime: true,
  });

  await waitForContainerReady(containerName);

  const preloadLibraries = getPsqlValue(containerName, 'SHOW shared_preload_libraries');
  const logs = getContainerLogs(containerName);

  assertCondition(
    !preloadLibraries.includes('pg_stat_statements'),
    'Fresh install still preloaded pg_stat_statements despite missing runtime files.'
  );
  assertCondition(
    hasPgStatStatementsMissingRuntimeWarning(logs),
    'Fresh install logs did not record the missing pg_stat_statements runtime warning.'
  );
  assertCondition(
    !hasPgStatStatementsFatalStartup(logs),
    'Fresh install still hit the historical pg_stat_statements FATAL startup failure.'
  );
}

async function runExistingClusterRecoverySmoke({ imageName, volumeName, containerName, recoveryContainerName }) {
  console.log('SMOKE: existing cluster with stale preload after runtime files disappear');
  createVolume(volumeName);
  startSmokeContainer({
    containerName,
    volumeName,
    imageName,
    stripPgssRuntime: false,
  });

  await waitForContainerReady(containerName);
  const baselinePreloadLibraries = getPsqlValue(containerName, 'SHOW shared_preload_libraries');
  assertCondition(
    baselinePreloadLibraries.includes('pg_stat_statements'),
    'Baseline existing-cluster smoke did not start with pg_stat_statements preloaded.'
  );

  docker('rm', '-f', containerName);

  startSmokeContainer({
    containerName: recoveryContainerName,
    volumeName,
    imageName,
    stripPgssRuntime: true,
  });
  await waitForContainerReady(recoveryContainerName);

  const recoveredPreloadLibraries = getPsqlValue(recoveryContainerName, 'SHOW shared_preload_libraries');
  const logs = getContainerLogs(recoveryContainerName);

  assertCondition(
    !recoveredPreloadLibraries.includes('pg_stat_statements'),
    'Recovered cluster still preloaded pg_stat_statements after runtime files were removed.'
  );
  assertCondition(
    hasPgStatStatementsMissingRuntimeWarning(logs),
    'Recovered cluster logs did not record the missing pg_stat_statements runtime warning.'
  );
  assertCondition(
    !hasPgStatStatementsFatalStartup(logs),
    'Recovered cluster still hit the historical pg_stat_statements FATAL startup failure.'
  );
}

async function runUpgradeCarryoverSmoke({
  imageName,
  volumeName,
  containerName,
  previousContainerName,
}) {
  console.log('SMOKE: PG17 upgrade normalizes postgresql.auto.conf library paths');
  createVolume(volumeName);
  startPreviousPgvectorContainer({
    containerName: previousContainerName,
    volumeName,
  });
  await waitForPostgresReady(previousContainerName);
  dockerSh(previousContainerName, buildPg17UpgradeCarryoverPreparationCommand());
  docker('stop', previousContainerName);
  docker('rm', previousContainerName);

  prepareVolumeWithCommand({
    volumeName,
    imageName,
    shellCommand: 'set -eu; chown -R classifarr:classifarr /app/data',
  });

  startSmokeContainer({
    containerName,
    volumeName,
    imageName,
    stripPgssRuntime: false,
  });
  await waitForContainerReady(containerName);

  const logs = getContainerLogs(containerName);
  const pgVersion = getPsqlValue(containerName, 'SHOW server_version_num');
  const dynamicLibraryPath = getPsqlValue(containerName, 'SHOW dynamic_library_path');
  const pgvectorVersion = getPsqlValue(
    containerName,
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );
  const autoConfig = getFileContents(containerName, '/app/data/postgres/postgresql.auto.conf');

  assertCondition(
    hasPostgres17To18UpgradeLog(logs),
    'Upgrade smoke did not log the PostgreSQL 17 -> 18 auto-upgrade path.'
  );
  assertCondition(
    pgVersion.startsWith('180'),
    `Upgrade smoke did not boot PostgreSQL 18 after upgrade. server_version_num=${pgVersion}`
  );
  assertCondition(
    dynamicLibraryPath.includes('/run/postgresql/pgvector:$libdir'),
    `Upgrade smoke did not normalize dynamic_library_path in the live server. dynamic_library_path=${dynamicLibraryPath}`
  );
  assertCondition(
    !dynamicLibraryPath.includes('/run/postgresql/pgvector, $libdir'),
    `Upgrade smoke still exposed the historical comma-separated dynamic_library_path. dynamic_library_path=${dynamicLibraryPath}`
  );
  assertCondition(
    autoConfig.includes("dynamic_library_path = '/run/postgresql/pgvector:$libdir'"),
    'Upgrade smoke did not normalize postgresql.auto.conf after upgrade.'
  );
  assertCondition(
    pgvectorVersion === PGVECTOR_TARGET_VERSION,
    `Upgrade smoke did not update pgvector to ${PGVECTOR_TARGET_VERSION}. extversion=${pgvectorVersion}`
  );
}

async function runIncludedConfigDiagnosticsSmoke({ imageName, volumeName, containerName }) {
  console.log('SMOKE: included config diagnostics surface include_dir path issues');
  createVolume(volumeName);
  prepareVolumeWithCommand({
    volumeName,
    imageName,
    shellCommand: buildIncludedConfigFailurePreparationCommand(),
  });

  startSmokeContainer({
    containerName,
    volumeName,
    imageName,
    stripPgssRuntime: false,
  });
  await waitForContainerExit(containerName);

  const logs = getContainerLogs(containerName);

  assertCondition(
    hasPgStatStatementsFatalStartup(logs),
    'Included-config smoke did not reproduce the expected pg_stat_statements startup failure.'
  );
  assertCondition(
    hasPostgresIncludeDirectiveDiagnostics(
      logs,
      '/app/data/postgres/postgresql.auto.conf',
      'include_dir',
      'conf.d'
    ),
    'Included-config smoke did not surface include_dir diagnostics for postgresql.auto.conf.'
  );
  assertCondition(
    logs.includes(
      'If include/include_dir directives are listed above, inspect those files too; Classifarr only auto-normalizes postgresql.conf and postgresql.auto.conf.'
    ),
    'Included-config smoke did not print the follow-up troubleshooting hint for include/include_dir directives.'
  );
}

export async function runPgStatStartupSmoke({ imageName = DEFAULT_IMAGE_NAME } = {}) {
  const {
    freshVolume,
    existingVolume,
    upgradeVolume,
    includeVolume,
    freshContainer,
    baselineContainer,
    recoveryContainer,
    upgradeSeedContainer,
    upgradeContainer,
    includeContainer,
  } = createSmokeRunNames();

  try {
    ensureRemovedContainer(freshContainer);
    ensureRemovedContainer(baselineContainer);
    ensureRemovedContainer(recoveryContainer);
    ensureRemovedContainer(upgradeSeedContainer);
    ensureRemovedContainer(upgradeContainer);
    ensureRemovedContainer(includeContainer);
    ensureRemovedVolume(freshVolume);
    ensureRemovedVolume(existingVolume);
    ensureRemovedVolume(upgradeVolume);
    ensureRemovedVolume(includeVolume);

    await runFreshInstallSmoke({
      imageName,
      volumeName: freshVolume,
      containerName: freshContainer,
    });

    await runExistingClusterRecoverySmoke({
      imageName,
      volumeName: existingVolume,
      containerName: baselineContainer,
      recoveryContainerName: recoveryContainer,
    });

    await runUpgradeCarryoverSmoke({
      imageName,
      volumeName: upgradeVolume,
      containerName: upgradeContainer,
      previousContainerName: upgradeSeedContainer,
    });

    await runIncludedConfigDiagnosticsSmoke({
      imageName,
      volumeName: includeVolume,
      containerName: includeContainer,
    });
  } finally {
    ensureRemovedContainer(freshContainer);
    ensureRemovedContainer(baselineContainer);
    ensureRemovedContainer(recoveryContainer);
    ensureRemovedContainer(upgradeSeedContainer);
    ensureRemovedContainer(upgradeContainer);
    ensureRemovedContainer(includeContainer);
    ensureRemovedVolume(freshVolume);
    ensureRemovedVolume(existingVolume);
    ensureRemovedVolume(upgradeVolume);
    ensureRemovedVolume(includeVolume);
  }
}

async function main() {
  try {
    await runPgStatStartupSmoke();
    console.log('pg_stat_statements startup smoke passed.');
  } catch (error) {
    console.error('pg_stat_statements startup smoke failed:', error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
