/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

/**
 * Wraps a mock object so it satisfies both named-export and default-export
 * consumption patterns used by jest.unstable_mockModule.
 *
 * @param {object} obj
 * @returns {{ [key: string]: unknown, default: object }}
 */
export function createMockModule(obj) {
  return { ...obj, default: obj };
}

/**
 * Creates a mock module for a named singleton export (Phase 7+ pattern).
 * Satisfies `import { exportName }` AND individual method imports.
 *
 * @param {string} exportName - The named export identifier (e.g. 'policyEngine')
 * @param {object} obj - The mock object
 * @returns {{ [exportName]: object, [method]: fn, default: object }}
 */
export function createNamedMockModule(exportName, obj) {
  return { [exportName]: obj, ...obj, default: obj };
}

/**
 * Creates a minimal ESM stub module for a single named export.
 * Useful when runtime code imports only the named symbol and no default wrapper.
 *
 * @param {string} exportName - The named export identifier (e.g. 'tmdbService')
 * @param {unknown} value - Stub value for the named export
 * @returns {{ [exportName]: unknown }}
 */
export function createNamedStubModule(exportName, value = {}) {
  return { [exportName]: value };
}

/**
 * Creates a named service stub module and pre-wired jest.fn method stubs.
 * Useful for route tests that repeatedly define method bundles by hand.
 *
 * @param {string} exportName - Named export identifier for the service singleton
 * @param {string[]} methodNames - Method names to stub with jest.fn
 * @returns {{ service: Record<string, jest.Mock>, module: { [key: string]: Record<string, jest.Mock> } }}
 */
export function createNamedServiceStub(exportName, methodNames = []) {
  const service = createServiceStubs(methodNames);
  return {
    service,
    module: createNamedStubModule(exportName, service),
  };
}

/**
 * Creates a plain object whose listed methods are all jest.fn stubs.
 * Useful for service tests that need a mock object without module wrapping.
 *
 * @param {string[]} methodNames
 * @param {object} [overrides]
 * @returns {Record<string, jest.Mock | unknown>}
 */
export function createServiceStubs(methodNames = [], overrides = {}) {
  return {
    ...Object.fromEntries(methodNames.map((methodName) => [methodName, jest.fn()])),
    ...overrides,
  };
}

/**
 * Creates a minimal ESM stub module for a default-only export.
 * Useful when runtime code imports only the module default value.
 *
 * @param {unknown} value - Stub value for the default export
 * @returns {{ default: unknown }}
 */
export function createDefaultStubModule(value = {}) {
  return { default: value };
}

/**
 * Creates a standard logger mock with jest.fn() stubs for info/warn/error/debug.
 *
 * @returns {{ info: jest.Mock, warn: jest.Mock, error: jest.Mock, debug: jest.Mock }}
 */
export function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Creates a database mock with a query stub and optional additional members.
 *
 * @param {object} [overrides]
 * @returns {{ query: jest.Mock, [key: string]: unknown }}
 */
export function createMockDb(overrides = {}) {
  return {
    query: jest.fn(),
    ...overrides,
  };
}

/**
 * Reapplies the standard encryption mock implementations used by ESM test
 * suites that statically link against the full utils/encryption.mjs surface.
 *
 * @param {object} mockEncryption
 * @param {object} [overrides]
 * @returns {object}
 */
export function resetEncryptionMock(mockEncryption, overrides = {}) {
  const {
    encryptValue = (value) => ({
      encrypted: `enc:${value}`,
      iv: 'test-iv',
      authTag: 'test-tag',
    }),
    formatEncryptedValue = (encrypted, iv, authTag) => `${encrypted}$${iv}$${authTag}`,
    decryptValue = (value) => (value ? `decrypted:${value}` : null),
    parseEncryptedValue = (value) => ({
      encrypted: value,
      iv: 'test-iv',
      authTag: 'test-tag',
    }),
    generateRandomKey = (prefix, byteLength = 24) => `${prefix}${'x'.repeat(byteLength)}`,
    maskKey = (key, visibleChars = 8) => {
      if (!key) return '';
      return `${String(key).slice(0, visibleChars)}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022`;
    },
    constantTimeCompare = (a, b) => a === b,
  } = overrides;

  mockEncryption.encryptValue.mockImplementation(encryptValue);
  mockEncryption.formatEncryptedValue.mockImplementation(formatEncryptedValue);
  mockEncryption.decryptValue.mockImplementation(decryptValue);
  mockEncryption.parseEncryptedValue.mockImplementation(parseEncryptedValue);
  mockEncryption.generateRandomKey.mockImplementation(generateRandomKey);
  mockEncryption.maskKey.mockImplementation(maskKey);
  mockEncryption.constantTimeCompare.mockImplementation(constantTimeCompare);

  return mockEncryption;
}

/**
 * Creates the standard encryption mock object used by ESM test suites.
 *
 * @param {object} [overrides]
 * @returns {{
 *   encryptValue: jest.Mock,
 *   formatEncryptedValue: jest.Mock,
 *   decryptValue: jest.Mock,
 *   parseEncryptedValue: jest.Mock,
 *   generateRandomKey: jest.Mock,
 *   maskKey: jest.Mock,
 *   constantTimeCompare: jest.Mock,
 * }}
 */
export function createEncryptionMock(overrides = {}) {
  return resetEncryptionMock({
    encryptValue: jest.fn(),
    formatEncryptedValue: jest.fn(),
    decryptValue: jest.fn(),
    parseEncryptedValue: jest.fn(),
    generateRandomKey: jest.fn(),
    maskKey: jest.fn(),
    constantTimeCompare: jest.fn(),
  }, overrides);
}

/**
 * Creates a database query result payload with rows and a matching rowCount.
 *
 * @param {object[]} [rows]
 * @param {object} [overrides]
 * @returns {{ rows: object[], rowCount: number }}
 */
export function createDbRowsResult(rows = [], overrides = {}) {
  return {
    rows,
    rowCount: rows.length,
    ...overrides,
  };
}

/**
 * Creates a database query result payload for a single-row lookup.
 *
 * @param {object} row
 * @param {object} [overrides]
 * @returns {{ rows: object[], rowCount: number }}
 */
export function createDbSingleRowResult(row, overrides = {}) {
  return createDbRowsResult([row], overrides);
}

/**
 * Creates a database write result payload.
 *
 * @param {number} [rowCount]
 * @param {object[]} [rows]
 * @param {object} [overrides]
 * @returns {{ rowCount: number, rows: object[] }}
 */
export function createDbWriteResult(rowCount = 1, rows = [], overrides = {}) {
  return {
    rowCount,
    rows,
    ...overrides,
  };
}

/**
 * Creates a database mock with a transaction helper that uses the current
 * pool.connect implementation, allowing tests to override the returned client.
 *
 * @param {object} [overrides]
 * @returns {{ query: jest.Mock, pool: { connect: jest.Mock, end: jest.Mock }, withTransaction: jest.Mock }}
 */
export function createTransactionalDbMock(overrides = {}) {
  const { pool: poolOverrides = {}, ...dbOverrides } = overrides;
  const defaultClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const pool = {
    connect: jest.fn().mockResolvedValue(defaultClient),
    end: jest.fn(),
    ...poolOverrides,
  };
  const mockDb = createMockDb({
    pool,
    ...dbOverrides,
  });

  if (!mockDb.withTransaction) {
    mockDb.withTransaction = jest.fn(async (fn) => {
      const conn = await mockDb.pool.connect();
      try {
        await conn.query('BEGIN');
        const result = await fn(conn);
        await conn.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await conn.query('ROLLBACK');
        } catch {
          // Preserve the original failure when rollback also fails.
        }
        throw err;
      } finally {
        conn.release();
      }
    });
  }

  return mockDb;
}

/**
 * Creates an Express-style response mock with common chainable methods.
 *
 * @param {object} [overrides]
 * @returns {{ status: jest.Mock, json: jest.Mock, send: jest.Mock, end: jest.Mock }}
 */
export function createHttpResponseMock(overrides = {}) {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    end: jest.fn(),
    ...overrides,
  };

  if (typeof response.status.mockReturnThis === 'function') {
    response.status.mockReturnThis();
  }
  if (typeof response.json.mockReturnThis === 'function') {
    response.json.mockReturnThis();
  }
  if (typeof response.send.mockReturnThis === 'function') {
    response.send.mockReturnThis();
  }
  if (typeof response.end.mockReturnThis === 'function') {
    response.end.mockReturnThis();
  }

  return response;
}

/**
 * Creates a logger module mock payload and the underlying logger instance.
 *
 * @returns {{ logger: ReturnType<typeof createMockLogger>, module: { createLogger: jest.Mock, setLoggerDb: jest.Mock, default: object } }}
 */
export function createLoggerModuleMock() {
  const logger = createMockLogger();
  const createLogger = jest.fn(() => logger);
  const setLoggerDb = jest.fn();
  return {
    logger,
    module: createMockModule({
      createLogger,
      setLoggerDb,
    }),
  };
}

/**
 * Resets a list of jest mock functions.
 *
 * @param {...(jest.Mock | undefined | null)} mocks
 */
export function resetJestMocks(...mocks) {
  for (const mock of mocks) {
    if (mock && typeof mock.mockReset === 'function') {
      mock.mockReset();
    }
  }
}

/**
 * Restores spies/replaced properties and resets specified mocks.
 *
 * @param {...(jest.Mock | undefined | null)} mocks
 */
export function restoreAllAndResetMocks(...mocks) {
  jest.restoreAllMocks();
  resetJestMocks(...mocks);
}

/**
 * Creates a mock for the auth middleware module that injects a user into req.user
 * and passes through to the next middleware. Suitable for route tests that need
 * an authenticated request with a specific user context.
 *
 * @param {object} [user] - User object to inject. Defaults to { id: 1, username: 'admin', role: 'admin' }.
 * @returns {{ authenticateToken: Function, requireAdmin: Function }}
 */
export function createAdminAuthMock(user = { id: 1, username: 'admin', role: 'admin' }) {
  return {
    authenticateToken: (req, _res, next) => { req.user = user; next(); },
    requireAdmin: (_req, _res, next) => next(),
  };
}

/**
 * Creates a mock for the auth middleware module that passes all requests through
 * without any authentication or user injection. Suitable for route tests that
 * don't exercise authentication logic.
 *
 * @returns {{ authenticateToken: Function, requireAdmin: Function }}
 */
export function createPassThroughAuthMock() {
  return {
    authenticateToken: (_req, _res, next) => next(),
    requireAdmin: (_req, _res, next) => next(),
  };
}

/**
 * Creates a mock module for the database config that exports both the pool object
 * and provides a query method. Suitable for service/route tests that interact with
 * the database. Automatically wrapped with createNamedMockModule for ESM compatibility.
 *
 * @param {object} [overrides] - Overrides for specific methods (e.g., { query: jest.fn(...) }).
 * @returns { default: object, pool: object, query: Function }
 */
export function createDatabaseModuleMock(overrides = {}) {
  const mockDb = {
    query: jest.fn(),
    pool: {
      connect: jest.fn(),
      end: jest.fn(),
    },
    ...overrides,
  };

  // Return in the shape that createNamedMockModule('pool', db) would produce
  return {
    default: mockDb,
    pool: mockDb,
  };
}

/**
 * Factory for mocking the logger.mjs module.
 * Satisfies both `import { createLogger }` and default-export patterns.
 *
 * @returns {{ createLogger: () => mock, setLoggerDb: jest.Mock, default: object }}
 */
export function loggerMockFactory() {
  const mockLogger = createMockLogger();
  const factory = () => mockLogger;
  return {
    createLogger: factory,
    setLoggerDb: jest.fn(),
    default: {
      createLogger: factory,
      setLoggerDb: jest.fn(),
    },
  };
}
