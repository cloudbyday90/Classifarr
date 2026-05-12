/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  collectTestFiles,
  resolveMockFactoryImportPath,
  runMockMigration,
} from '../../../scripts/mockMigrationSupport.mjs';

describe('mockMigrationSupport', () => {
  it('collects only .test.mjs files recursively and skips dot-directories', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'classifarr-mock-support-'));

    try {
      mkdirSync(path.join(root, 'nested'));
      mkdirSync(path.join(root, '.ignored'));
      writeFileSync(path.join(root, 'root.test.mjs'), '');
      writeFileSync(path.join(root, 'root.test.js'), '');
      writeFileSync(path.join(root, 'nested', 'child.test.mjs'), '');
      writeFileSync(path.join(root, '.ignored', 'ignored.test.mjs'), '');

      expect(collectTestFiles(root).map((filePath) => path.basename(filePath)).sort()).toEqual([
        'child.test.mjs',
        'root.test.mjs',
      ]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('resolves a mockFactory import path for top-level and nested test files', () => {
    const testsRoot = 'C:/repo/server/src/__tests__';

    expect(resolveMockFactoryImportPath(testsRoot, 'C:/repo/server/src/__tests__/health.test.mjs')).toBe('./helpers/mockFactory.mjs');
    expect(resolveMockFactoryImportPath(testsRoot, 'C:/repo/server/src/__tests__/integration/plexOAuth.test.mjs')).toBe('../helpers/mockFactory.mjs');
  });

  it('runs the shared migration loop and rewrites only matching test files', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'classifarr-mock-runner-'));
    const log = jest.fn();

    try {
      writeFileSync(path.join(root, 'match.test.mjs'), 'TARGET');
      writeFileSync(path.join(root, 'skip.test.mjs'), 'IGNORE');

      const result = runMockMigration({
        dryRun: false,
        isCandidate: (content) => content.includes('TARGET'),
        log,
        migrateFile: (content) => ({
          content: content.replace('TARGET', 'DONE'),
          changed: content.includes('TARGET'),
        }),
        serverRoot: root,
        testsRoot: root,
      });

      expect(readFileSync(path.join(root, 'match.test.mjs'), 'utf8')).toBe('DONE');
      expect(readFileSync(path.join(root, 'skip.test.mjs'), 'utf8')).toBe('IGNORE');
      expect(result).toEqual({
        migratedCount: 1,
        skippedCount: 1,
        summary: 'Done. Migrated 1 files, skipped 1.',
      });
      expect(log).toHaveBeenCalledWith('Migrated: match.test.mjs');
      expect(log).toHaveBeenCalledWith('Done. Migrated 1 files, skipped 1.');
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('reports dry-run migrations without writing files', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'classifarr-mock-dry-run-'));
    const log = jest.fn();

    try {
      writeFileSync(path.join(root, 'match.test.mjs'), 'TARGET');

      runMockMigration({
        dryRun: true,
        isCandidate: (content) => content.includes('TARGET'),
        log,
        migrateFile: (content) => ({
          content: content.replace('TARGET', 'DONE'),
          changed: content.includes('TARGET'),
        }),
        serverRoot: root,
        testsRoot: root,
      });

      expect(readFileSync(path.join(root, 'match.test.mjs'), 'utf8')).toBe('TARGET');
      expect(log).toHaveBeenCalledWith('[DRY RUN] Would migrate: match.test.mjs');
      expect(log).toHaveBeenCalledWith('Done. Migrated 1 files, skipped 0.');
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
