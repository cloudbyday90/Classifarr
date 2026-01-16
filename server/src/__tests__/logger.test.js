/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

// Mock database before requiring logger
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

// Mock fs for file logger
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    appendFileSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({ size: 100 }),
    readdirSync: jest.fn().mockReturnValue([]),
    renameSync: jest.fn(),
    unlinkSync: jest.fn(),
    createReadStream: jest.fn(),
    createWriteStream: jest.fn()
}));

const db = require('../config/database');
const { createLogger, sanitizeData, getSystemContext } = require('../utils/logger');

describe('Logger', () => {
    let logger;

    beforeEach(() => {
        jest.clearAllMocks();
        logger = createLogger('TestModule');
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

            // This should NOT throw
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
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            db.query.mockRejectedValueOnce(new Error('DB error'));

            await logger.error('Important error message', { key: 'value' });

            expect(consoleSpy).toHaveBeenCalled();
            expect(consoleSpy.mock.calls[0][0]).toContain('Important error message');
            consoleSpy.mockRestore();
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
    });

    describe('info()', () => {
        test('should log to console', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            logger.info('Info message', { key: 'value' });

            expect(consoleSpy).toHaveBeenCalled();
            expect(consoleSpy.mock.calls[0][0]).toContain('Info message');
            consoleSpy.mockRestore();
        });
    });

    describe('debug()', () => {
        test('should log to console when debug level is enabled', () => {
            const debugLogger = createLogger('DebugModule');
            debugLogger.level = 3; // DEBUG level
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            debugLogger.debug('Debug message', { key: 'value' });

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
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
