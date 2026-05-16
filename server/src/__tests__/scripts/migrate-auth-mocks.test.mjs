/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAuthMockMigration } from '../../../scripts/migrate-auth-mocks.mjs';

function finalizeAuthFixture(source) {
  return source
    .replaceAll('__MOCK_MODULE__', 'jest.unstable_mockModule')
    .replaceAll('__AUTH_PATH__', ['..', 'middleware', 'auth.mjs'].join('/'));
}

function authLiteral(text) {
  return text
    .replaceAll('__MOCK_MODULE__', 'jest.unstable_mockModule')
    .replaceAll('__AUTH_PATH__', ['..', 'middleware', 'auth.mjs'].join('/'));
}

function createAuthFixture(serverRoot) {
  const testsRoot = path.join(serverRoot, 'src', '__tests__');
  const helpersDir = path.join(testsRoot, 'helpers');
  mkdirSync(helpersDir, { recursive: true });
  writeFileSync(path.join(helpersDir, 'mockFactory.mjs'), '');

  const testFile = path.join(testsRoot, 'sample-auth.test.mjs');
  writeFileSync(testFile, finalizeAuthFixture(`import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockAuth = {
  authenticateToken: (_req, _res, next) => next(),
};
await __MOCK_MODULE__('__AUTH_PATH__', () => createNamedMockModule('router', mockAuth));
`));

  return { testFile, testsRoot };
}

describe('migrate-auth-mocks script', () => {
  it('reports dry-run migrations without rewriting files', () => {
    const serverRoot = mkdtempSync(path.join(tmpdir(), 'classifarr-auth-script-'));
    const log = jest.fn();

    try {
      const { testFile, testsRoot } = createAuthFixture(serverRoot);

      const result = runAuthMockMigration({ dryRun: true, log, serverRoot, testsRoot });

      expect(readFileSync(testFile, 'utf8')).toContain("createNamedMockModule('router', mockAuth)");
      expect(result).toEqual({
        migratedCount: 1,
        skippedCount: 0,
        summary: 'Done. Migrated 1 files, skipped 0.',
      });
      expect(log).toHaveBeenCalledWith(`[DRY RUN] Would migrate: ${path.join('src', '__tests__', 'sample-auth.test.mjs')}`);
    } finally {
      rmSync(serverRoot, { force: true, recursive: true });
    }
  });

  it('rewrites auth fixtures in write mode', () => {
    const serverRoot = mkdtempSync(path.join(tmpdir(), 'classifarr-auth-script-write-'));
    const log = jest.fn();

    try {
      const { testFile, testsRoot } = createAuthFixture(serverRoot);

      runAuthMockMigration({ dryRun: false, log, serverRoot, testsRoot });

      const content = readFileSync(testFile, 'utf8');
      expect(content).toContain("import { createNamedMockModule, createPassThroughAuthMock } from './helpers/mockFactory.mjs';");
      expect(content).toContain(authLiteral("await __MOCK_MODULE__('__AUTH_PATH__', () => createPassThroughAuthMock());"));
      expect(content).not.toContain('const mockAuth');
      expect(log).toHaveBeenCalledWith(`Migrated: ${path.join('src', '__tests__', 'sample-auth.test.mjs')}`);
    } finally {
      rmSync(serverRoot, { force: true, recursive: true });
    }
  });
});