/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import { createConsoleSpy } from './consoleHelpers.mjs';

const logSpy = createConsoleSpy('log', { suppress: true });
const infoSpy = createConsoleSpy('info', { suppress: true });
const warnSpy = createConsoleSpy('warn', { suppress: true });
const errorSpy = createConsoleSpy('error', { suppress: true });
const debugSpy = createConsoleSpy('debug', { suppress: true });

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const spyLogger = {
  log: logSpy.spy,
  info: infoSpy.spy,
  warn: warnSpy.spy,
  error: errorSpy.spy,
  debug: debugSpy.spy,
};

function restoreLogger() {
  spyLogger.log.mockRestore();
  spyLogger.info.mockRestore();
  spyLogger.warn.mockRestore();
  spyLogger.error.mockRestore();
  spyLogger.debug.mockRestore();
}

function clearLoggerMocks() {
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
  mockLogger.debug.mockClear();

  spyLogger.log.mockClear();
  spyLogger.info.mockClear();
  spyLogger.warn.mockClear();
  spyLogger.error.mockClear();
  spyLogger.debug.mockClear();
}

const loggerMocks = {
  mockLogger,
  spyLogger,
  restoreLogger,
  clearLoggerMocks,
};

export {
  mockLogger,
  spyLogger,
  restoreLogger,
  clearLoggerMocks,
};

export default loggerMocks;
