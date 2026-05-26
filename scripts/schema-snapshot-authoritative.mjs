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
import {
  checkSchemaSnapshotWithContainer,
  DEFAULT_IMAGE_NAME,
  dumpSchemaWithContainer,
} from './check-schema-snapshot-container.mjs';
import { dumpSchema, verifySourceDatabaseCurrent } from './dump-schema.mjs';

export function parseSchemaSnapshotAuthorityArgs(args = process.argv.slice(2)) {
  return {
    mode: args.includes('--dump') ? 'dump' : 'check',
    skipBuild: args.includes('--skip-build'),
  };
}

export function buildSchemaAuthorityDockerBuildArgs({
  imageName = DEFAULT_IMAGE_NAME,
  contextPath = '.',
} = {}) {
  return ['build', '-t', imageName, contextPath];
}

export function buildSchemaAuthorityContainerOptions({
  imageName = DEFAULT_IMAGE_NAME,
} = {}) {
  return {
    imageName,
  };
}

export async function runAuthoritativeSchemaSnapshot({
  mode = 'check',
  skipBuild = false,
  imageName = DEFAULT_IMAGE_NAME,
  contextPath = '.',
  execFileSyncImpl = execFileSync,
  dumpSchemaFn = dumpSchema,
  verifySourceDatabaseCurrentFn = verifySourceDatabaseCurrent,
  dumpSchemaWithContainerFn = dumpSchemaWithContainer,
  checkSchemaSnapshotWithContainerFn = checkSchemaSnapshotWithContainer,
  log = console,
} = {}) {
  if (mode === 'dump') {
    dumpSchemaFn({ log });
  } else {
    verifySourceDatabaseCurrentFn({ log });
  }

  if (!skipBuild) {
    log.log(`🏗️ Building authoritative schema snapshot image: ${imageName}`);
    execFileSyncImpl('docker', buildSchemaAuthorityDockerBuildArgs({ imageName, contextPath }), {
      stdio: 'inherit',
    });
  } else {
    log.log(`ℹ️ Skipping Docker image build for authoritative schema ${mode}.`);
  }

  const containerOptions = buildSchemaAuthorityContainerOptions({ imageName });
  if (mode === 'dump') {
    await dumpSchemaWithContainerFn(containerOptions);
    return;
  }

  await checkSchemaSnapshotWithContainerFn(containerOptions);
}

async function main() {
  const { mode, skipBuild } = parseSchemaSnapshotAuthorityArgs();

  try {
    await runAuthoritativeSchemaSnapshot({ mode, skipBuild });
    console.log(
      mode === 'dump'
        ? '✅ Authoritative schema snapshot dump passed.'
        : '✅ Authoritative schema snapshot check passed.'
    );
  } catch (error) {
    console.error(
      mode === 'dump'
        ? '❌ Authoritative schema snapshot dump failed:'
        : '❌ Authoritative schema snapshot check failed:',
      error.message
    );
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
