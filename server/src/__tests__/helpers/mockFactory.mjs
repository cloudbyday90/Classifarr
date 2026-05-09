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
  const service = Object.fromEntries(methodNames.map((methodName) => [methodName, jest.fn()]));
  return {
    service,
    module: createNamedStubModule(exportName, service),
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
