/**
 * Migration script: replace inline logger mock patterns with createLoggerModuleMock().
 *
 * Handles three variants:
 *   A) jest.unstable_mockModule('...logger.mjs', () => ({ createLogger: jest.fn(() => ({...})), }));
 *   B) const mockLoggerModule = { createLogger: jest.fn(() => ({...})) };
 *      jest.unstable_mockModule('...logger.mjs', () => createMockModule(mockLoggerModule));
 *   C) Single-line version of A
 *
 * All become:
 *   jest.unstable_mockModule('...logger.mjs', () => createLoggerModuleMock().module);
 *
 * Usage: node server/scripts/migrate-logger-mocks.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectTestFiles, resolveMockFactoryImportPath } from './mockMigrationSupport.mjs';
import { migrateLoggerMockContent } from './mockMigrationTransforms.mjs';

const serverRoot = path.join(import.meta.dirname, '..');
const testsRoot = path.join(serverRoot, 'src', '__tests__');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Main migration function for a single file.
 * Returns [newContent, changed] tuple.
 */
// ---- Main ----

const files = collectTestFiles(testsRoot);
let migratedCount = 0;
let skippedCount = 0;

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');

  // Quick check: does this file have an inline logger mock?
  const hasInlineLogger = /unstable_mockModule\s*\(\s*['"`][^'"`]*logger\.mjs['"`]/.test(content) &&
    /createLogger:\s*(jest\.fn\(\(\)\s*=>|\(\)\s*=>)/.test(content);

  const hasCreateMockModuleLogger = /unstable_mockModule\s*\(\s*['"`][^'"`]*logger\.mjs['"`].*?createMockModule\s*\(/s.test(content) &&
    /createLogger:\s*jest\.fn\(\(\)\s*=>/.test(content);

  if (!hasInlineLogger && !hasCreateMockModuleLogger) {
    skippedCount++;
    continue;
  }

  const { content: migratedContent, changed } = migrateLoggerMockContent(
    content,
    resolveMockFactoryImportPath(testsRoot, filePath),
  );

  if (!changed) {
    skippedCount++;
    continue;
  }

  const relPath = path.relative(serverRoot, filePath);
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would migrate: ${relPath}`);
  } else {
    writeFileSync(filePath, migratedContent, 'utf8');
    console.log(`Migrated: ${relPath}`);
  }
  migratedCount++;
}

console.log(`\nDone. Migrated ${migratedCount} files, skipped ${skippedCount}.`);
