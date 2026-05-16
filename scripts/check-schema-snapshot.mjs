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
import { relative, resolve } from 'node:path';
import { dumpSchema, OUTPUT_PATH } from './dump-schema.mjs';

function readSnapshotIfPresent() {
  return fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : null;
}

function printSchemaDiff() {
  const repoRelativePath = relative(process.cwd(), OUTPUT_PATH);
  try {
    const diff = execFileSync('git', ['diff', '--', repoRelativePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (diff.trim()) {
      console.error(diff);
    }
  } catch (error) {
    const diff = String(error?.stdout || '');
    if (diff.trim()) {
      console.error(diff);
      return;
    }
    console.error(`Schema snapshot changed: ${repoRelativePath}`);
  }
}

export function checkSchemaSnapshot() {
  const before = readSnapshotIfPresent();
  dumpSchema();
  const after = readSnapshotIfPresent();

  if (before !== after) {
    printSchemaDiff();
    throw new Error(
      'database/schema/current.sql is out of date. Run `npm run db:dump-schema` and commit the updated snapshot.'
    );
  }
}

function main() {
  try {
    checkSchemaSnapshot();
    console.log('✅ Schema snapshot is up to date.');
  } catch (error) {
    console.error('❌ Schema snapshot check failed:', error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
