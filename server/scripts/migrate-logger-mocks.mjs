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

import path from 'node:path';
import { resolveMockFactoryImportPath, runMockMigration } from './mockMigrationSupport.mjs';
import { migrateLoggerMockContent } from './mockMigrationTransforms.mjs';

const serverRoot = path.join(import.meta.dirname, '..');
const testsRoot = path.join(serverRoot, 'src', '__tests__');

const DRY_RUN = process.argv.includes('--dry-run');

runMockMigration({
  dryRun: DRY_RUN,
  isCandidate: (content) => (
    /unstable_mockModule\s*\(\s*['"`][^'"`]*logger\.mjs['"`]/.test(content) &&
    /createLogger:\s*(jest\.fn\(\(\)\s*=>|\(\)\s*=>)/.test(content)
  ) || (
    /unstable_mockModule\s*\(\s*['"`][^'"`]*logger\.mjs['"`].*?createMockModule\s*\(/s.test(content) &&
    /createLogger:\s*jest\.fn\(\(\)\s*=>/.test(content)
  ),
  migrateFile: (content, filePath) => migrateLoggerMockContent(
    content,
    resolveMockFactoryImportPath(testsRoot, filePath),
  ),
  serverRoot,
  testsRoot,
});
