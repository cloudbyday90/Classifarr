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

import path from 'node:path';
import { resolveMockFactoryImportPath, runMockMigration } from './mockMigrationSupport.mjs';
import { isAuthMockMigrationCandidate, migrateAuthMockContent } from './mockMigrationTransforms.mjs';

const serverRoot = path.join(import.meta.dirname, '..');
const testsRoot = path.join(serverRoot, 'src', '__tests__');
const DRY_RUN = process.argv.includes('--dry-run');

export function runAuthMockMigration({
  dryRun = false,
  log,
  serverRoot: currentServerRoot = serverRoot,
  testsRoot: currentTestsRoot = path.join(currentServerRoot, 'src', '__tests__'),
} = {}) {
  return runMockMigration({
    dryRun,
    isCandidate: isAuthMockMigrationCandidate,
    log,
    migrateFile: (content, filePath) => migrateAuthMockContent(
      content,
      resolveMockFactoryImportPath(currentTestsRoot, filePath),
    ),
    serverRoot: currentServerRoot,
    testsRoot: currentTestsRoot,
  });
}

if (import.meta.main) {
  runAuthMockMigration({ dryRun: DRY_RUN });
}
