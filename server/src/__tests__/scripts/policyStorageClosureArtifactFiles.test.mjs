/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readPolicyStorageClosureArtifactJson,
  resolvePolicyStorageClosureArtifactPath,
  writePolicyStorageClosureArtifactJson,
} from '../../../../scripts/lib/policyStorageClosureArtifactFiles.mjs';

describe('policyStorageClosureArtifactFiles', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-storage-closure-files-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('resolves relative input and output paths from the selected checkout', () => {
    const relativePath = path.join('.artifacts', 'evidence.json');
    const expectedPath = path.join(fixtureRoot, relativePath);

    writePolicyStorageClosureArtifactJson({
      cwd: fixtureRoot,
      filePath: relativePath,
      value: { source: 'selected-checkout' },
    });

    expect(resolvePolicyStorageClosureArtifactPath(fixtureRoot, relativePath))
      .toBe(expectedPath);
    expect(readPolicyStorageClosureArtifactJson({
      cwd: fixtureRoot,
      filePath: relativePath,
      label: 'evidence',
      required: true,
    })).toEqual({ source: 'selected-checkout' });
  });

  test('preserves an explicit absolute artifact path', () => {
    const artifactPath = path.join(fixtureRoot, 'absolute-evidence.json');

    expect(resolvePolicyStorageClosureArtifactPath(fixtureRoot, artifactPath))
      .toBe(artifactPath);
  });

  test('rejects a missing required artifact before attempting a read', () => {
    expect(() => readPolicyStorageClosureArtifactJson({
      cwd: fixtureRoot,
      filePath: null,
      label: 'validation evidence',
      required: true,
    })).toThrow('Missing required validation evidence JSON path.');
  });
});
