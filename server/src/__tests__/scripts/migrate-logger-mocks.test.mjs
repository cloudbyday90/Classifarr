/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runLoggerMockMigration } from '../../../scripts/migrate-logger-mocks.mjs';

function finalizeLoggerFixture(source) {
  return source
    .replaceAll('__MOCK_MODULE__', 'jest.unstable_mockModule')
    .replaceAll('__LOGGER_PATH__', ['..', 'utils', 'logger.mjs'].join('/'))
    .replaceAll('__CREATE_LOGGER__', 'createLogger');
}

function loggerLiteral(text) {
  return text
    .replaceAll('__MOCK_MODULE__', 'jest.unstable_mockModule')
    .replaceAll('__LOGGER_PATH__', ['..', 'utils', 'logger.mjs'].join('/'));
}

function createLoggerFixture(serverRoot) {
  const testsRoot = path.join(serverRoot, 'src', '__tests__');
  const helpersDir = path.join(testsRoot, 'helpers');
  mkdirSync(helpersDir, { recursive: true });
  writeFileSync(path.join(helpersDir, 'mockFactory.mjs'), '');

  const testFile = path.join(testsRoot, 'sample-logger.test.mjs');
  writeFileSync(testFile, finalizeLoggerFixture(`import { createMockModule } from './helpers/mockFactory.mjs';

const mockLogger = {
  __CREATE_LOGGER__: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
};
__MOCK_MODULE__('__LOGGER_PATH__', () => createMockModule(mockLogger));
`));

  return { testFile, testsRoot };
}

function createExternalLoggerFixture(serverRoot) {
  const testsRoot = path.join(serverRoot, 'src', '__tests__');
  const helpersDir = path.join(testsRoot, 'helpers');
  mkdirSync(helpersDir, { recursive: true });
  writeFileSync(path.join(helpersDir, 'mockFactory.mjs'), '');

  const testFile = path.join(testsRoot, 'sample-logger-external.test.mjs');
  writeFileSync(testFile, finalizeLoggerFixture(`import { createMockModule } from './helpers/mockFactory.mjs';

const externalLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockLogger = {
  __CREATE_LOGGER__: () => ({
    info: externalLogger.info,
    warn: externalLogger.warn,
    error: externalLogger.error,
    debug: externalLogger.debug,
  }),
};
__MOCK_MODULE__('__LOGGER_PATH__', () => createMockModule(mockLogger));
`));

  return { testFile, testsRoot };
}

describe('migrate-logger-mocks script', () => {
  it('reports dry-run migrations without rewriting files', () => {
    const serverRoot = mkdtempSync(path.join(tmpdir(), 'classifarr-logger-script-'));
    const log = jest.fn();

    try {
      const { testFile, testsRoot } = createLoggerFixture(serverRoot);

      const result = runLoggerMockMigration({ dryRun: true, log, serverRoot, testsRoot });

      expect(readFileSync(testFile, 'utf8')).toContain("createMockModule(mockLogger)");
      expect(result).toEqual({
        migratedCount: 1,
        skippedCount: 0,
        summary: 'Done. Migrated 1 files, skipped 0.',
      });
      expect(log).toHaveBeenCalledWith('[DRY RUN] Would migrate: src\\__tests__\\sample-logger.test.mjs');
    } finally {
      rmSync(serverRoot, { force: true, recursive: true });
    }
  });

  it('rewrites logger fixtures in write mode', () => {
    const serverRoot = mkdtempSync(path.join(tmpdir(), 'classifarr-logger-script-write-'));
    const log = jest.fn();

    try {
      const { testFile, testsRoot } = createLoggerFixture(serverRoot);

      runLoggerMockMigration({ dryRun: false, log, serverRoot, testsRoot });

      const content = readFileSync(testFile, 'utf8');
      expect(content).toContain("import { createMockModule, createLoggerModuleMock } from './helpers/mockFactory.mjs';");
      expect(content).toContain(loggerLiteral("__MOCK_MODULE__('__LOGGER_PATH__', () => createLoggerModuleMock().module)"));
      expect(content).not.toContain('const mockLogger');
      expect(log).toHaveBeenCalledWith('Migrated: src\\__tests__\\sample-logger.test.mjs');
    } finally {
      rmSync(serverRoot, { force: true, recursive: true });
    }
  });

  it('preserves external logger references without rewriting them', () => {
    const serverRoot = mkdtempSync(path.join(tmpdir(), 'classifarr-logger-script-external-'));
    const log = jest.fn();

    try {
      const { testFile, testsRoot } = createExternalLoggerFixture(serverRoot);
      const originalContent = readFileSync(testFile, 'utf8');

      const result = runLoggerMockMigration({ dryRun: false, log, serverRoot, testsRoot });

      expect(readFileSync(testFile, 'utf8')).toBe(originalContent);
      expect(result).toEqual({
        migratedCount: 0,
        skippedCount: 1,
        summary: 'Done. Migrated 0 files, skipped 1.',
      });
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Migrated: src\\__tests__\\sample-logger-external.test.mjs'));
    } finally {
      rmSync(serverRoot, { force: true, recursive: true });
    }
  });
});