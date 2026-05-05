/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => ({
  ...mockDb,
  default: mockDb,
}));

const mockFs = {
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 100 }),
  readdirSync: jest.fn().mockReturnValue([]),
  renameSync: jest.fn(),
  unlinkSync: jest.fn(),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
};

jest.mock('fs', () => mockFs);
jest.unstable_mockModule('fs', () => ({ ...mockFs, default: mockFs }));

const { Logger, createLogger, sanitizeData, getSystemContext, setLoggerDb } = await import('../utils/logger');
const { createConsoleSpy } = await import('./setup/consoleHelpers.js');

const db = mockDb;

describe('Logger', () => {
    let logger;
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        Logger.logDedupeCache.clear();
        Logger.dedupeWriteCount = 0;
        setLoggerDb(db);
        logger = createLogger('TestModule');
        consoleErrorSpy = createConsoleSpy('error', { suppress: true });
        consoleWarnSpy = createConsoleSpy('warn', { suppress: true });
    });

    afterEach(() => {
        consoleErrorSpy.restore();
        consoleWarnSpy.restore();
    });

    describe('createLogger', () => {
        test('should create a logger with specified module name', () => {
            const testLogger = createLogger('MyModule');
            expect(testLogger.module).toBe('MyModule');
        });

        test('should have all logging methods', () => {
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });
    });

    describe('error() resilience', () => {
        test('should not throw when persistToDb fails', async () => {
            db.query.mockRejectedValueOnce(new Error('Database connection failed'));

            await expect(logger.error('Test error', { data: 'test' })).resolves.toBeNull();
        });

        test('should not throw when persistToDb throws synchronously', async () => {
            db.query.mockImplementationOnce(() => {
                throw new Error('Sync error');
            });

            await expect(logger.error('Test error', { data: 'test' })).resolves.toBeNull();
        });

        test('should return error ID when DB succeeds', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ error_id: 'test-uuid-123' }]
            });

            const result = await logger.error('Test error', { data: 'test' });
            expect(result).toBe('test-uuid-123');
        });

        test('should still log to console when DB fails', async () => {
            db.query.mockRejectedValueOnce(new Error('DB error'));

            await logger.error('Important error message', { key: 'value' });

            expect(consoleErrorSpy.spy).toHaveBeenCalled();
            expect(consoleErrorSpy.spy.mock.calls[0][0]).toContain('Important error message');
        });

        test('should persist upstream error stack when provided in options', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ error_id: 'stack-uuid-789' }]
            });

            const upstream = new Error('Upstream boom');
            await logger.error('Test error', { key: 'value' }, { error: upstream });

            expect(db.query).toHaveBeenCalled();
            const params = db.query.mock.calls[0][1];
            expect(params[3]).toBe(upstream.stack);
        });

        test('should persist upstream error stack when provided in metadata', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ error_id: 'stack-uuid-790' }]
            });

            const upstream = new Error('Upstream in metadata');
            await logger.error('Test error', { error: upstream });

            expect(db.query).toHaveBeenCalled();
            const params = db.query.mock.calls[0][1];
            expect(params[3]).toBe(upstream.stack);
        });
    });

    describe('warn() resilience', () => {
        test('should not throw when persistToDb fails', async () => {
            db.query.mockRejectedValueOnce(new Error('Database connection failed'));

            await expect(logger.warn('Test warning', { data: 'test' })).resolves.toBeNull();
        });

        test('should return error ID when DB succeeds', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ error_id: 'warn-uuid-456' }]
            });

            const result = await logger.warn('Test warning', { data: 'test' });
            expect(result).toBe('warn-uuid-456');
        });

        test('should not persist a synthetic stack for warn without upstream error', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ error_id: 'warn-uuid-457' }]
            });

            await logger.warn('Test warning', { data: 'test' });

            expect(db.query).toHaveBeenCalled();
            const params = db.query.mock.calls[0][1];
            expect(params[3]).toBeNull();
        });

        test('should persist upstream error stack for warn when provided', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ error_id: 'warn-uuid-458' }]
            });

            const upstream = new Error('Warn upstream');
            await logger.warn('Test warning', { error: upstream });

            expect(db.query).toHaveBeenCalled();
            const params = db.query.mock.calls[0][1];
            expect(params[3]).toBe(upstream.stack);
        });

        test('should dedupe warn logs when dedupe key is reused inside the window', async () => {
            db.query.mockResolvedValue({
                rows: [{ error_id: 'warn-uuid-459' }]
            });

            await logger.warn('Repeated warning', { data: 'first' }, {
                dedupeKey: 'repeated-warning',
                dedupeWindowMs: 60000
            });

            await logger.warn('Repeated warning', { data: 'second' }, {
                dedupeKey: 'repeated-warning',
                dedupeWindowMs: 60000
            });

            expect(consoleWarnSpy.spy).toHaveBeenCalledTimes(1);
            expect(db.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('info()', () => {
        test('should log to console', () => {
            const consoleSpy = createConsoleSpy('log', { suppress: true });

            logger.info('Info message', { key: 'value' });

            expect(consoleSpy.spy).toHaveBeenCalled();
            expect(consoleSpy.spy.mock.calls[0][0]).toContain('Info message');
            consoleSpy.restore();
        });
    });

    describe('debug()', () => {
        test('should log to console when debug level is enabled', () => {
            const debugLogger = createLogger('DebugModule');
            debugLogger.level = 3;
            const consoleSpy = createConsoleSpy('log', { suppress: true });

            debugLogger.debug('Debug message', { key: 'value' });

            expect(consoleSpy.spy).toHaveBeenCalled();
            consoleSpy.restore();
        });
    });

    describe('sanitizeData', () => {
        test('should redact sensitive fields', () => {
            const data = {
                username: 'john',
                password: 'secret123',
                api_key: 'key123',
                normal_field: 'visible'
            };

            const sanitized = sanitizeData(data);

            expect(sanitized.username).toBe('john');
            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.api_key).toBe('[REDACTED]');
            expect(sanitized.normal_field).toBe('visible');
        });

        test('should handle nested objects', () => {
            const data = {
                user: {
                    name: 'john',
                    token: 'secret'
                }
            };

            const sanitized = sanitizeData(data);

            expect(sanitized.user.name).toBe('john');
            expect(sanitized.user.token).toBe('[REDACTED]');
        });

        test('should return non-objects unchanged', () => {
            expect(sanitizeData(null)).toBe(null);
            expect(sanitizeData('string')).toBe('string');
            expect(sanitizeData(123)).toBe(123);
        });
    });

    describe('getSystemContext', () => {
        test('should return system information', () => {
            const context = getSystemContext();

            expect(context).toHaveProperty('nodeVersion');
            expect(context).toHaveProperty('platform');
            expect(context).toHaveProperty('arch');
            expect(context).toHaveProperty('uptime');
            expect(context).toHaveProperty('memory');
            expect(context).toHaveProperty('hostname');
        });

        test('should include memory information', () => {
            const context = getSystemContext();

            expect(context.memory).toHaveProperty('total');
            expect(context.memory).toHaveProperty('free');
            expect(context.memory).toHaveProperty('used');
        });
    });
});
