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
