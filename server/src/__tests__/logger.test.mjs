/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any static imports of the modules under test.
// ---------------------------------------------------------------------------

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => ({
  ...mockDb,
  default: mockDb,
}));

// ---------------------------------------------------------------------------
// Imports — dynamic to ensure mocks are in place first.
// ---------------------------------------------------------------------------

const {
  createLogger,
  setLoggerDb,
  sanitizeData,
  getSystemContext,
  cleanupOldLogs,
  Logger,
  resetDedupeState,
  logDedupeCache,
} = await import('../utils/logger');

const { createConsoleSpy } = await import('./setup/consoleHelpers.mjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetAll() {
  jest.clearAllMocks();
  resetDedupeState();
  setLoggerDb(mockDb);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Logger (pino-backed)', () => {
  let logger;
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    resetAll();
    logger = createLogger('TestModule');
    consoleLogSpy = createConsoleSpy('log', { suppress: true });
    consoleErrorSpy = createConsoleSpy('error', { suppress: true });
    consoleWarnSpy = createConsoleSpy('warn', { suppress: true });
  });

  afterEach(() => {
    consoleLogSpy.restore();
    consoleErrorSpy.restore();
    consoleWarnSpy.restore();
  });

  describe('createLogger', () => {
    test('creates a logger with the specified module name', () => {
      const l = createLogger('MyModule');
      expect(l.module).toBe('MyModule');
    });

    test('returned object has all four logging methods', () => {
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    test('each createLogger call returns a new instance', () => {
      const a = createLogger('A');
      const b = createLogger('B');
      expect(a).not.toBe(b);
      expect(a.module).toBe('A');
      expect(b.module).toBe('B');
    });
  });

  describe('error() resilience', () => {
    test('resolves to null when DB query rejects', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));
      await expect(logger.error('Test error', { data: 'test' })).resolves.toBeNull();
    });

    test('resolves to null when DB query throws synchronously', async () => {
      mockDb.query.mockImplementationOnce(() => { throw new Error('Sync error'); });
      await expect(logger.error('Test error', { data: 'test' })).resolves.toBeNull();
    });

    test('returns the error_id UUID when DB succeeds', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'test-uuid-123' }] });
      const result = await logger.error('Test error', { data: 'test' });
      expect(result).toBe('test-uuid-123');
    });

    test('persists upstream error stack when provided in options.error', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'stack-uuid-789' }] });
      const upstream = new Error('Upstream boom');
      await logger.error('Test error', { key: 'value' }, { error: upstream });
      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBe(upstream.stack);
    });

    test('persists upstream error stack when provided in data.error', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'stack-uuid-790' }] });
      const upstream = new Error('Upstream in metadata');
      await logger.error('Test error', { error: upstream });
      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBe(upstream.stack);
    });

    test('resolves to null and skips DB when skipDbPersist is true', async () => {
      const result = await logger.error('No persist', {}, { skipDbPersist: true });
      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('resolves to null when no DB is registered', async () => {
      setLoggerDb(null);
      const result = await logger.error('No DB', {});
      expect(result).toBeNull();
    });
  });

  describe('warn() resilience', () => {
    test('resolves to null when DB query rejects', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));
      await expect(logger.warn('Test warning', { data: 'test' })).resolves.toBeNull();
    });

    test('returns the error_id UUID when DB succeeds', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'warn-uuid-456' }] });
      const result = await logger.warn('Test warning', { data: 'test' });
      expect(result).toBe('warn-uuid-456');
    });

    test('does not persist a synthetic stack for warn without upstream error', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'warn-uuid-457' }] });
      await logger.warn('Test warning', { data: 'test' });
      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBeNull();
    });

    test('persists upstream error stack for warn when provided in data.error', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'warn-uuid-458' }] });
      const upstream = new Error('Warn upstream');
      await logger.warn('Test warning', { error: upstream });
      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBe(upstream.stack);
    });

    test('deduplicates warn logs with same dedupeKey within the window', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ error_id: 'warn-uuid-459' }] });
      await logger.warn('Repeated warning', { data: 'first' }, { dedupeKey: 'repeated-warning', dedupeWindowMs: 60000 });
      await logger.warn('Repeated warning', { data: 'second' }, { dedupeKey: 'repeated-warning', dedupeWindowMs: 60000 });
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    test('resolves to null and skips DB when skipDbPersist is true', async () => {
      const result = await logger.warn('No persist', {}, { skipDbPersist: true });
      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('info()', () => {
    test('does not invoke DB query', () => {
      logger.info('Info message', { key: 'value' });
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('does not throw', () => {
      expect(() => logger.info('Info message')).not.toThrow();
    });

    test('accepts a call with no data argument', () => {
      expect(() => logger.info('No data')).not.toThrow();
    });
  });

  describe('debug()', () => {
    test('does not invoke DB query', () => {
      logger.debug('Debug message', { key: 'value' });
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('does not throw', () => {
      expect(() => logger.debug('Debug message')).not.toThrow();
    });
  });

  describe('sanitizeData (re-exported)', () => {
    test('redacts sensitive fields', () => {
      const sanitized = sanitizeData({ username: 'john', password: 'secret123', api_key: 'key123', normal_field: 'visible' });
      expect(sanitized.username).toBe('john');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.normal_field).toBe('visible');
    });

    test('handles nested objects', () => {
      const sanitized = sanitizeData({ user: { name: 'john', token: 'secret' } });
      expect(sanitized.user.name).toBe('john');
      expect(sanitized.user.token).toBe('[REDACTED]');
    });

    test('returns non-objects unchanged', () => {
      expect(sanitizeData(null)).toBe(null);
      expect(sanitizeData('string')).toBe('string');
      expect(sanitizeData(123)).toBe(123);
    });
  });

  describe('getSystemContext (re-exported)', () => {
    test('returns system information fields', () => {
      const context = getSystemContext();
      expect(context).toHaveProperty('nodeVersion');
      expect(context).toHaveProperty('platform');
      expect(context).toHaveProperty('arch');
      expect(context).toHaveProperty('uptime');
      expect(context).toHaveProperty('memory');
      expect(context).toHaveProperty('hostname');
    });

    test('memory includes total, free, used', () => {
      const { memory } = getSystemContext();
      expect(memory).toHaveProperty('total');
      expect(memory).toHaveProperty('free');
      expect(memory).toHaveProperty('used');
    });
  });

  describe('setLoggerDb', () => {
    test('registers DB so error() persist works', async () => {
      setLoggerDb(mockDb);
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'db-test-id' }] });
      const id = await logger.error('DB registered', {});
      expect(id).toBe('db-test-id');
    });

    test('when DB is null, error() resolves to null without throwing', async () => {
      setLoggerDb(null);
      const result = await logger.error('No DB', {});
      expect(result).toBeNull();
    });
  });

  describe('DB persist column order', () => {
    test('error() inserts correct column order: level, module, message, stack_trace, ...', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'col-test-1' }] });
      await logger.error('Column test', { key: 'val' });
      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toBe('ERROR');
      expect(params[1]).toBe('TestModule');
      expect(params[2]).toBe('Column test');
      expect(typeof params[3]).toBe('string');
      expect(params[4]).toBeNull();
    });

    test('warn() inserts WARN as level', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ error_id: 'col-warn-1' }] });
      await logger.warn('Warn column test', {});
      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toBe('WARN');
    });
  });

  describe('cleanupOldLogs', () => {
    test('is a function', () => {
      expect(typeof cleanupOldLogs).toBe('function');
    });

    test('does not throw', () => {
      expect(() => cleanupOldLogs()).not.toThrow();
    });
  });
});
