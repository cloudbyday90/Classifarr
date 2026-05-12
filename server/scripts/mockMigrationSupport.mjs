/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function collectTestFiles(dir) {
  const files = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(fullPath);
    }
  }

  return files;
}

export function resolveMockFactoryImportPath(testsRoot, filePath) {
  const helperPath = path.join(testsRoot, 'helpers', 'mockFactory.mjs');
  const relativePath = path.relative(path.dirname(filePath), helperPath).replaceAll('\\', '/');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

export function runMockMigration({
  dryRun = false,
  isCandidate,
  log = console.log,
  migrateFile,
  readFile = readFileSync,
  serverRoot,
  testsRoot,
  writeFile = writeFileSync,
}) {
  const files = collectTestFiles(testsRoot);
  let migratedCount = 0;
  let skippedCount = 0;

  for (const filePath of files) {
    const content = readFile(filePath, 'utf8');

    if (!isCandidate(content, filePath)) {
      skippedCount += 1;
      continue;
    }

    const { content: migratedContent, changed } = migrateFile(content, filePath);

    if (!changed) {
      skippedCount += 1;
      continue;
    }

    const relPath = path.relative(serverRoot, filePath);
    if (dryRun) {
      log(`[DRY RUN] Would migrate: ${relPath}`);
    } else {
      writeFile(filePath, migratedContent, 'utf8');
      log(`Migrated: ${relPath}`);
    }

    migratedCount += 1;
  }

  const summary = `Done. Migrated ${migratedCount} files, skipped ${skippedCount}.`;
  log(summary);
  return { migratedCount, skippedCount, summary };
}