/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

// Mock logger to suppress console output in tests
const { createConsoleSpy } = require('./consoleHelpers');

const infoSpy = createConsoleSpy('info', { suppress: true });
const warnSpy = createConsoleSpy('warn', { suppress: true });
const errorSpy = createConsoleSpy('error', { suppress: true });
const debugSpy = createConsoleSpy('debug', { suppress: true });

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Spy on actual logger for verification tests
const spyLogger = {
  info: infoSpy.spy,
  warn: warnSpy.spy,
  error: errorSpy.spy,
  debug: debugSpy.spy
};

// Restore original logger for specific tests
function restoreLogger() {
  spyLogger.info.mockRestore();
  spyLogger.warn.mockRestore();
  spyLogger.error.mockRestore();
  spyLogger.debug.mockRestore();
}

// Clear all logger mocks
function clearLoggerMocks() {
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
  mockLogger.debug.mockClear();
  
  spyLogger.info.mockClear();
  spyLogger.warn.mockClear();
  spyLogger.error.mockClear();
  spyLogger.debug.mockClear();
}

module.exports = {
  mockLogger,
  spyLogger,
  restoreLogger,
  clearLoggerMocks
};
