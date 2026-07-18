/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import path from 'node:path';

import {
  getLocalStaticImportPaths,
  hasImportedMockSetup,
  requiresDynamicImportForMockOrder,
} from '../../../../scripts/lib/staticImportCandidateAssessment.mjs';

const TEST_FILE_PATH = path.join('C:', 'repo', 'server', 'src', '__tests__', 'integration', 'example.test.mjs');

describe('staticImportCandidateAssessment', () => {
  test('finds a local static integration setup import', () => {
    const paths = getLocalStaticImportPaths(
      "import { getPool } from './setup.mjs';\nimport { test } from '@jest/globals';",
      TEST_FILE_PATH,
    );

    expect(paths).toEqual([
      path.join('C:', 'repo', 'server', 'src', '__tests__', 'integration', 'setup.mjs'),
    ]);
  });

  test('recognizes a locally imported ESM mock boundary', () => {
    const source = "import { getPool } from './setup.mjs';\nconst service = await import('../../services/example.mjs');";
    const setupPath = path.join('C:', 'repo', 'server', 'src', '__tests__', 'integration', 'setup.mjs');

    expect(hasImportedMockSetup({
      source,
      filePath: TEST_FILE_PATH,
      readSource: importedPath => importedPath === setupPath
        ? "jest.unstable_mockModule('../../config/database.mjs', () => ({}));"
        : '',
    })).toBe(true);
    expect(requiresDynamicImportForMockOrder({
      source,
      filePath: TEST_FILE_PATH,
      readSource: importedPath => importedPath === setupPath
        ? "jest.unstable_mockModule('../../config/database.mjs', () => ({}));"
        : '',
    })).toBe(true);
  });

  test('does not exempt a dynamic import without a direct or imported mock boundary', () => {
    const source = "import { getPool } from './setup.mjs';\nconst service = await import('../../services/example.mjs');";

    expect(requiresDynamicImportForMockOrder({
      source,
      filePath: TEST_FILE_PATH,
      readSource: () => 'export const getPool = () => null;',
    })).toBe(false);
  });
});
