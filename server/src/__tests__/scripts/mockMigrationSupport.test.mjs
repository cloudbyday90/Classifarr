/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  collectTestFiles,
  resolveMockFactoryImportPath,
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
});
