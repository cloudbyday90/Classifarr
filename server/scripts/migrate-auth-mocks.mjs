/**
 * Migration script: Extract inline auth middleware mocks to createAdminAuthMock / createPassThroughAuthMock
 * 
 * Patterns handled:
 * A) Simple pass-through:
 *    jest.unstable_mockModule('../middleware/auth.mjs', () => ({
 *      authenticateToken: (_req, _res, next) => next(),
 *      requireAdmin: (_req, _res, next) => next(),
 *    }));
 *    → jest.unstable_mockModule('../middleware/auth.mjs', () => createPassThroughAuthMock());
 * 
 * B) With user assignment:
 *    jest.unstable_mockModule('../middleware/auth.mjs', () => ({
 *      authenticateToken: (req, _res, next) => { req.user = {...}; next(); },
 *      requireAdmin: ...
 *    }));
 *    → jest.unstable_mockModule('../middleware/auth.mjs', () => createAdminAuthMock({...}));
 * 
 * C) Variable-based:
 *    const mockAuth = { authenticateToken: ..., requireAdmin: ... };
 *    jest.unstable_mockModule('../middleware/auth.mjs', () => ({...mockAuth}));
 *    → jest.unstable_mockModule('../middleware/auth.mjs', () => createAdminAuthMock(...));
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectTestFiles, resolveMockFactoryImportPath } from './mockMigrationSupport.mjs';
import { migrateAuthMockContent } from './mockMigrationTransforms.mjs';

const serverRoot = path.join(import.meta.dirname, '..');
const testsRoot = path.join(serverRoot, 'src', '__tests__');
const DRY_RUN = process.argv.includes('--dry-run');

// ---- Main ----

const files = collectTestFiles(testsRoot);
let migratedCount = 0;
let skippedCount = 0;

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');

  // Quick check: does this file have an auth.mjs mock not already using our factories?
  const hasAuthMock = /jest\.unstable_mockModule\s*\(\s*['"`][^'"`]*middleware\/auth\.mjs['"`]/.test(content);
  const alreadyMigrated = /createAdminAuthMock|createPassThroughAuthMock/.test(content);

  if (!hasAuthMock || alreadyMigrated) {
    skippedCount++;
    continue;
  }

  const { content: migratedContent, changed } = migrateAuthMockContent(
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

console.log(`Done. Migrated ${migratedCount} files, skipped ${skippedCount}.`);
