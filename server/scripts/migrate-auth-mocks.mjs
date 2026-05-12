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
import { migrateAuthMockContent } from './mockMigrationTransforms.mjs';

const serverRoot = path.join(import.meta.dirname, '..');
const testsRoot = path.join(serverRoot, 'src', '__tests__');
const DRY_RUN = process.argv.includes('--dry-run');

runMockMigration({
  dryRun: DRY_RUN,
  isCandidate: (content) => /middleware\/auth\.mjs|authenticateToken:\s*\([^)]*\)\s*=>/.test(content),
  migrateFile: (content, filePath) => migrateAuthMockContent(
    content,
    resolveMockFactoryImportPath(testsRoot, filePath),
  ),
  serverRoot,
  testsRoot,
});
