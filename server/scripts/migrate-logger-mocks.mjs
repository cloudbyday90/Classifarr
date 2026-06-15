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

/**
 * Migration script: run the shared logger-mock migration over server tests.
 *
 * Detection and content rewrites live in mockMigrationTransforms.mjs.
 * File traversal, dry-run reporting, and writes live in mockMigrationSupport.mjs.
 * This entrypoint stays as a thin native-ESM wrapper around those shared seams.
 *
 * Usage: node server/scripts/migrate-logger-mocks.mjs [--dry-run]
 */

import path from 'node:path';
import { resolveMockFactoryImportPath, runMockMigration } from './mockMigrationSupport.mjs';
import { isLoggerMockMigrationCandidate, migrateLoggerMockContent } from './mockMigrationTransforms.mjs';

const serverRoot = path.join(import.meta.dirname, '..');
const testsRoot = path.join(serverRoot, 'src', '__tests__');

const DRY_RUN = process.argv.includes('--dry-run');

export function runLoggerMockMigration({
  dryRun = false,
  log,
  serverRoot: currentServerRoot = serverRoot,
  testsRoot: currentTestsRoot = path.join(currentServerRoot, 'src', '__tests__'),
} = {}) {
  return runMockMigration({
    dryRun,
    isCandidate: isLoggerMockMigrationCandidate,
    log,
    migrateFile: (content, filePath) => migrateLoggerMockContent(
      content,
      resolveMockFactoryImportPath(currentTestsRoot, filePath),
    ),
    serverRoot: currentServerRoot,
    testsRoot: currentTestsRoot,
  });
}

if (import.meta.main) {
  runLoggerMockMigration({ dryRun: DRY_RUN });
}
