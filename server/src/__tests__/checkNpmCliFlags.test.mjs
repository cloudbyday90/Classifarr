/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0-or-later - See LICENSE file for details.
 */

import {
  checkNpmCliFlags,
  DEFAULT_IGNORE_PATTERNS,
  findLegacyNpmCliFlags,
  formatLegacyNpmCliFlagViolation,
  scanContentForLegacyNpmCliFlags,
} from '../../../scripts/check-npm-cli-flags.mjs';

describe('check-npm-cli-flags tooling', () => {
  test.each([
    'npm rebuild bcrypt --build-from-source',
    'npm --prefix server rebuild bcrypt --build-from-source=true',
  ])('rejects unsupported native-build configuration: %s', command => {
    expect(scanContentForLegacyNpmCliFlags(command, 'docs/install.md')).toEqual([
      expect.objectContaining({ patternKey: 'npm-build-from-source' }),
    ]);
  });

  test('allows reviewed native rebuilds without unsupported npm flags', () => {
    expect(scanContentForLegacyNpmCliFlags('npm --prefix server rebuild bcrypt', 'docs/install.md')).toEqual([]);
  });

  test('detects npm ci only-production usage', () => {
    const violations = scanContentForLegacyNpmCliFlags(
      'RUN npm ci --only=production',
      'Dockerfile'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        filePath: 'Dockerfile',
        lineNumber: 1,
        patternKey: 'npm-ci-only-production',
      }),
    ]);
  });

  test('detects npm install production usage', () => {
    const violations = scanContentForLegacyNpmCliFlags(
      'npm install --production',
      'README.md'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        filePath: 'README.md',
        lineNumber: 1,
        patternKey: 'npm-install-production',
      }),
    ]);
  });

  test('ignores current omit-based installs', () => {
    const violations = scanContentForLegacyNpmCliFlags(
      'RUN npm ci --omit=dev',
      'Dockerfile'
    );

    expect(violations).toEqual([]);
  });

  test('formats violations with path, line number, and guidance', () => {
    const formatted = formatLegacyNpmCliFlagViolation({
      filePath: 'Dockerfile',
      lineNumber: 3,
      patternKey: 'npm-ci-only-production',
      description: 'Use `npm ci --omit=dev` instead.',
      lineText: 'RUN npm ci --only=production',
    });

    expect(formatted).toContain('Dockerfile:3 [npm-ci-only-production]');
    expect(formatted).toContain('RUN npm ci --only=production');
  });

  test('supports targeted file-entry scans for deterministic tests', () => {
    const violations = findLegacyNpmCliFlags({
      fileEntries: [
        { filePath: 'Dockerfile', content: 'RUN npm ci --only=production' },
        { filePath: 'docs/install.md', content: 'npm ci --omit=dev' },
      ],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual(
      expect.objectContaining({
        filePath: 'Dockerfile',
        patternKey: 'npm-ci-only-production',
      })
    );
  });

  test('documents changelog exclusions for historical references', () => {
    expect(DEFAULT_IGNORE_PATTERNS).toEqual(
      expect.arrayContaining(['CHANGELOG.md', 'CHANGELOG_backup.md'])
    );
  });

  test('throws when a legacy npm CLI flag is present', () => {
    expect(() =>
      checkNpmCliFlags({
        fileEntries: [{ filePath: 'Dockerfile', content: 'RUN npm ci --only=production' }],
      })
    ).toThrow(/Legacy npm CLI flags detected/u);
  });
});
