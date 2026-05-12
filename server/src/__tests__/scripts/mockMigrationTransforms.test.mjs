/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  isAuthMockMigrationCandidate,
  isLoggerMockMigrationCandidate,
  migrateAuthMockContent,
  migrateLoggerMockContent,
} from '../../../scripts/mockMigrationTransforms.mjs';

function finalizeFixture(source) {
  return source
    .replaceAll('__MOCK_MODULE__', 'jest.unstable_mockModule')
    .replaceAll('__AUTH_PATH__', ['..', 'middleware', 'auth.mjs'].join('/'))
    .replaceAll('__LOGGER_PATH__', '../utils/logger.mjs')
    .replaceAll('__AUTHENTICATE_TOKEN__', 'authenticateToken')
    .replaceAll('__REQUIRE_ADMIN__', 'requireAdmin');
}

function literalFixture(text) {
  return text
    .replaceAll('__MOCK_MODULE__', 'jest.unstable_mockModule')
    .replaceAll('__LOGGER_PATH__', '../utils/logger.mjs');
}

function literalAuthFixture(text) {
  return text
    .replaceAll('__MOCK_MODULE__', 'jest.unstable_mockModule')
    .replaceAll('__AUTH_PATH__', ['..', 'middleware', 'auth.mjs'].join('/'));
}

describe('mockMigrationTransforms', () => {
  it('detects auth migration candidates but ignores unrelated files', () => {
    expect(isAuthMockMigrationCandidate(finalizeFixture(`
__MOCK_MODULE__('__AUTH_PATH__', () => ({
  __AUTHENTICATE_TOKEN__: (_req, _res, next) => next(),
}));
`))).toBe(true);

    expect(isAuthMockMigrationCandidate(`import { createPassThroughAuthMock } from './helpers/mockFactory.mjs';\nconst noop = true;\n`)).toBe(false);
  });

  it('detects logger migration candidates but ignores logger helpers without module mocks', () => {
    expect(isLoggerMockMigrationCandidate(finalizeFixture(`
__MOCK_MODULE__('__LOGGER_PATH__', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })
}));
`))).toBe(true);

    expect(isLoggerMockMigrationCandidate(`const logger = { createLogger: () => mockLogger };\n`)).toBe(false);
  });

  it('migrates variable-based pass-through auth mocks and removes the now-unused mock variable', () => {
    const source = finalizeFixture(`import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockAuth = {
      __AUTHENTICATE_TOKEN__: (_req, _res, next) => next(),
};
await __MOCK_MODULE__('__AUTH_PATH__', () => createNamedMockModule('router', mockAuth));
`);

    const { content, changed } = migrateAuthMockContent(source, './helpers/mockFactory.mjs');

    expect(changed).toBe(true);
    expect(content).toContain("import { createNamedMockModule, createPassThroughAuthMock } from './helpers/mockFactory.mjs';");
    expect(content).toContain(literalAuthFixture("await __MOCK_MODULE__('__AUTH_PATH__', () => createPassThroughAuthMock());"));
    expect(content).not.toContain('const mockAuth');
  });

  it('migrates variable-based admin auth mocks to createAdminAuthMock', () => {
    const source = finalizeFixture(`import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockAuth = {
      __AUTHENTICATE_TOKEN__: (req, _res, next) => {
    req.user = { userId: 1 };
    next();
  }
};
__MOCK_MODULE__('__AUTH_PATH__', () => createNamedMockModule('router', mockAuth));
`);

    const { content, changed } = migrateAuthMockContent(source, './helpers/mockFactory.mjs');

    expect(changed).toBe(true);
    expect(content).toContain("createAdminAuthMock({ userId: 1 })");
    expect(content).not.toContain('const mockAuth');
  });

  it('adds helper imports cleanly when the existing mockFactory import already has a trailing comma', () => {
    const source = finalizeFixture(`import {
  createNamedMockModule,
} from './helpers/mockFactory.mjs';

const mockAuth = {
      __AUTHENTICATE_TOKEN__: (_req, _res, next) => next(),
};
__MOCK_MODULE__('__AUTH_PATH__', () => createNamedMockModule('router', mockAuth));
`);

    const { content } = migrateAuthMockContent(source, './helpers/mockFactory.mjs');

    expect(content).toContain("import { createNamedMockModule, createPassThroughAuthMock } from './helpers/mockFactory.mjs';");
    expect(content).not.toContain(',,');
  });

  it('removes redundant simple auth declarations after a helper-based migration already exists', () => {
    const source = finalizeFixture(`import { createPassThroughAuthMock } from './helpers/mockFactory.mjs';

const mockAuth = {
      __AUTHENTICATE_TOKEN__: (_req, _res, next) => next(),
      __REQUIRE_ADMIN__: (_req, _res, next) => next(),
};
__MOCK_MODULE__('__AUTH_PATH__', () => createPassThroughAuthMock());
`);

    const { content, changed } = migrateAuthMockContent(source, './helpers/mockFactory.mjs');

    expect(changed).toBe(true);
    expect(content).toContain(literalAuthFixture("__MOCK_MODULE__('__AUTH_PATH__', () => createPassThroughAuthMock())"));
    expect(content).not.toContain('const mockAuth');
  });

  it('migrates inline logger mocks to createLoggerModuleMock', () => {
    const source = finalizeFixture(`import { createMockModule } from './helpers/mockFactory.mjs';

const mockLogger = {
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
};
__MOCK_MODULE__('__LOGGER_PATH__', () => createMockModule(mockLogger));
`);

    const { content, changed } = migrateLoggerMockContent(source, './helpers/mockFactory.mjs');

    expect(changed).toBe(true);
    expect(content).toContain('createLoggerModuleMock');
    expect(content).toContain(literalFixture("__MOCK_MODULE__('__LOGGER_PATH__', () => createLoggerModuleMock().module)"));
  });

  it('migrates variable-based bare-arrow logger mocks wrapped with createMockModule', () => {
    const source = finalizeFixture(`import { createMockModule } from './helpers/mockFactory.mjs';

const mockLogger = {
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
};
__MOCK_MODULE__('__LOGGER_PATH__', () => createMockModule(mockLogger));
`);

    const { content, changed } = migrateLoggerMockContent(source, './helpers/mockFactory.mjs');

    expect(changed).toBe(true);
    expect(content).toContain('createLoggerModuleMock');
    expect(content).toContain(literalFixture("__MOCK_MODULE__('__LOGGER_PATH__', () => createLoggerModuleMock().module)"));
    expect(content).not.toContain('const mockLogger');
  });
});