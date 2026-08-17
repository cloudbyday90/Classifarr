/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Database Resilience Tests
 * Ensures database connection errors don't crash the application (regression prevention)
 * 
 * Background: v0.39.5a-alpha hotfix removed process.exit(-1) from database.mjs
 * which was causing containers to crash (Exit 255) on transient connection errors.
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createConsoleSpy } from './setup/consoleHelpers.mjs';
import { loadDatabaseModule } from './setup/loadDatabaseModule.mjs';

const databaseImplementationPath = path.join(import.meta.dirname, '..', 'config', 'database.mjs');
const legacyDatabaseWrapperPath = path.join(import.meta.dirname, '..', 'config', 'database.js');

describe('Database Resilience', () => {
    describe('Static Analysis - No process.exit in database implementation', () => {
        it('should NOT contain process.exit in the database config', () => {
            const content = fs.readFileSync(databaseImplementationPath, 'utf-8');

            expect(content).not.toMatch(/process\.exit/);
        });

        it('should have a pool error handler that logs but does not exit', () => {
            const content = fs.readFileSync(databaseImplementationPath, 'utf-8');

            expect(content).toMatch(/pool\.on\(['"]error['"]/);

            expect(content).toMatch(/logger\.error.*[Uu]nexpected error/);
        });

        it('does not keep a legacy database.js compatibility wrapper around the native implementation', () => {
            expect(fs.existsSync(legacyDatabaseWrapperPath)).toBe(false);
        });
    });

    describe('Pool Error Handler Behavior', () => {
        let originalProcessExit;
        let processExitCalled = false;
        let consoleSpy;

        beforeAll(() => {
            originalProcessExit = process.exit;
            process.exit = jest.fn(() => {
                processExitCalled = true;
            });
        });

        afterAll(() => {
            process.exit = originalProcessExit;
        });

        beforeEach(() => {
            processExitCalled = false;
            jest.clearAllMocks();
            consoleSpy = createConsoleSpy('error', { suppress: true });
        });

        afterEach(() => {
            if (consoleSpy) {
                consoleSpy.restore();
            }
        });

        it('should not call process.exit when pool emits an error event', () => {
            const mockPool = new EventEmitter();

            mockPool.on('error', (err) => {
                // eslint-disable-next-line no-console -- simulating production error handler under test
                console.error('Unexpected error on idle client', err);
            });

            mockPool.emit('error', new Error('Connection terminated unexpectedly'));

            expect(process.exit).not.toHaveBeenCalled();
            expect(processExitCalled).toBe(false);
            expect(consoleSpy.spy).toHaveBeenCalled();
        });

        it('should handle ECONNRESET errors gracefully', () => {
            const mockPool = new EventEmitter();

            mockPool.on('error', (err) => {
                // eslint-disable-next-line no-console -- simulating production error handler under test
                console.error('Unexpected error on idle client', err);
            });

            const econnresetError = new Error('read ECONNRESET');
            econnresetError.code = 'ECONNRESET';

            mockPool.emit('error', econnresetError);

            expect(process.exit).not.toHaveBeenCalled();
            expect(consoleSpy.spy).toHaveBeenCalled();
        });

        it('should handle connection terminated errors gracefully', () => {
            const mockPool = new EventEmitter();

            mockPool.on('error', (err) => {
                // eslint-disable-next-line no-console -- simulating production error handler under test
                console.error('Unexpected error on idle client', err);
            });

            mockPool.emit('error', new Error('Connection terminated unexpectedly'));

            expect(process.exit).not.toHaveBeenCalled();
            expect(consoleSpy.spy).toHaveBeenCalled();
        });
    });

    describe('Database Module Integration', () => {
        it('should export query and pool', async () => {
            const { db } = await loadDatabaseModule();

            expect(db).toHaveProperty('query');
            expect(db).toHaveProperty('pool');
            expect(typeof db.query).toBe('function');
        });
    });

    describe('Pool Configuration - Timeouts and Limits', () => {
        it('should export healthCheck function', async () => {
            const { db } = await loadDatabaseModule();
            expect(typeof db.healthCheck).toBe('function');
        });

        it('should have connectionTimeoutMillis configured', () => {
            const content = fs.readFileSync(databaseImplementationPath, 'utf-8');
            expect(content).toMatch(/connectionTimeoutMillis/);
        });

        it('should have idleTimeoutMillis configured', () => {
            const content = fs.readFileSync(databaseImplementationPath, 'utf-8');
            expect(content).toMatch(/idleTimeoutMillis/);
        });

        it('should have statement_timeout configured', () => {
            const content = fs.readFileSync(databaseImplementationPath, 'utf-8');
            expect(content).toMatch(/statement_timeout/);
        });

        it('should have explicit max pool size configured', () => {
            const content = fs.readFileSync(databaseImplementationPath, 'utf-8');
            expect(content).toMatch(/POSTGRES_POOL_MAX/);
        });

        it('healthCheck should return { healthy: true } on successful connection', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({}),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            const result = await db.healthCheck();
            expect(result).toEqual({ healthy: true });
        });

        it('healthCheck should return { healthy: false, error } on connection failure', async () => {
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockRejectedValue(new Error('Connection refused'))
                }
            });
            const result = await db.healthCheck();
            expect(result).toMatchObject({ healthy: false, error: 'Connection refused' });
        });

        it('healthCheck sanitizes error message in production (no internal host/db info disclosed)', async () => {
            const originalEnv = process.env.NODE_ENV;
            const originalFileLogging = process.env.FILE_LOGGING_ENABLED;
            process.env.NODE_ENV = 'production';
            process.env.FILE_LOGGING_ENABLED = 'false';
            try {
                const { db } = await loadDatabaseModule({
                    pool: {
                        connect: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 172.20.0.2:5432'))
                    }
                });
                const result = await db.healthCheck();
                expect(result.healthy).toBe(false);
                expect(result.error).toBe('Database connection failed');
                expect(result.error).not.toMatch(/172\.20|ECONNREFUSED|5432/);
            } finally {
                process.env.NODE_ENV = originalEnv;
                if (originalFileLogging === undefined) {
                    delete process.env.FILE_LOGGING_ENABLED;
                } else {
                    process.env.FILE_LOGGING_ENABLED = originalFileLogging;
                }
            }
        });

        it('healthCheck should always release the client even on query failure', async () => {
            const mockClient = {
                query: jest.fn().mockRejectedValue(new Error('query error')),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            await db.healthCheck();
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('withTransaction()', () => {
        it('exports withTransaction function', async () => {
            const { db } = await loadDatabaseModule();
            expect(typeof db.withTransaction).toBe('function');
        });

        it('commits on success', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({}),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            const fn = jest.fn().mockResolvedValue('result');
            const result = await db.withTransaction(fn);
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(fn).toHaveBeenCalledWith(mockClient);
            expect(result).toBe('result');
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('rolls back and rethrows on error', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({}),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            const originalError = new Error('fn failed');
            const fn = jest.fn().mockRejectedValue(originalError);
            await expect(db.withTransaction(fn)).rejects.toThrow('fn failed');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('releases client even when ROLLBACK fails', async () => {
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({})
                    .mockRejectedValueOnce(new Error('rollback error')),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            const originalError = new Error('fn failed');
            const fn = jest.fn().mockRejectedValue(originalError);
            await expect(db.withTransaction(fn)).rejects.toThrow('fn failed');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('passes client to fn', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({}),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            let receivedClient;
            await db.withTransaction(async (client) => { receivedClient = client; });
            expect(receivedClient).toBe(mockClient);
        });
    });

    describe('Connection Acquisition Retry', () => {
        const TRANSIENT_MESSAGE = 'Connection terminated due to connection timeout';
        let retryWarnSpy;

        beforeEach(() => {
            retryWarnSpy = createConsoleSpy('warn', { suppress: true });
        });

        afterEach(() => {
            retryWarnSpy.restore();
        });

        it('retries a transient connection failure then succeeds for query()', async () => {
            const originalDelay = process.env.POSTGRES_CONNECT_RETRY_DELAY_MS;
            process.env.POSTGRES_CONNECT_RETRY_DELAY_MS = '0';
            try {
                const mockClient = {
                    query: jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
                    release: jest.fn()
                };
                const connect = jest.fn()
                    .mockRejectedValueOnce(new Error(TRANSIENT_MESSAGE))
                    .mockResolvedValueOnce(mockClient);
                const { db } = await loadDatabaseModule({ pool: { connect } });

                const result = await db.query('SELECT 1');

                expect(connect).toHaveBeenCalledTimes(2);
                expect(mockClient.query).toHaveBeenCalledTimes(1);
                expect(result).toEqual({ rows: [{ ok: 1 }] });
            } finally {
                if (originalDelay === undefined) delete process.env.POSTGRES_CONNECT_RETRY_DELAY_MS;
                else process.env.POSTGRES_CONNECT_RETRY_DELAY_MS = originalDelay;
            }
        });

        it('does not retry a non-transient connection failure', async () => {
            const connect = jest.fn().mockRejectedValue(new Error('password authentication failed'));
            const { db } = await loadDatabaseModule({ pool: { connect } });

            await expect(db.query('SELECT 1')).rejects.toThrow('password authentication failed');
            expect(connect).toHaveBeenCalledTimes(1);
        });

        it('does not re-run the query when only the connect step is retried', async () => {
            const originalDelay = process.env.POSTGRES_CONNECT_RETRY_DELAY_MS;
            process.env.POSTGRES_CONNECT_RETRY_DELAY_MS = '0';
            try {
                const mockClient = {
                    query: jest.fn().mockResolvedValue({ rows: [] }),
                    release: jest.fn()
                };
                const connect = jest.fn()
                    .mockRejectedValueOnce(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))
                    .mockResolvedValueOnce(mockClient);
                const { db } = await loadDatabaseModule({ pool: { connect } });

                await db.query('INSERT INTO t VALUES (1)');

                expect(mockClient.query).toHaveBeenCalledTimes(1);
            } finally {
                if (originalDelay === undefined) delete process.env.POSTGRES_CONNECT_RETRY_DELAY_MS;
                else process.env.POSTGRES_CONNECT_RETRY_DELAY_MS = originalDelay;
            }
        });

        it('gives up after the configured retry budget and throws the last error', async () => {
            const originalDelay = process.env.POSTGRES_CONNECT_RETRY_DELAY_MS;
            const originalRetries = process.env.POSTGRES_CONNECT_RETRIES;
            process.env.POSTGRES_CONNECT_RETRY_DELAY_MS = '0';
            process.env.POSTGRES_CONNECT_RETRIES = '2';
            try {
                const connect = jest.fn().mockRejectedValue(new Error(TRANSIENT_MESSAGE));
                const { db } = await loadDatabaseModule({ pool: { connect } });

                await expect(db.query('SELECT 1')).rejects.toThrow(TRANSIENT_MESSAGE);
                expect(connect).toHaveBeenCalledTimes(3); // initial + 2 retries
            } finally {
                if (originalDelay === undefined) delete process.env.POSTGRES_CONNECT_RETRY_DELAY_MS;
                else process.env.POSTGRES_CONNECT_RETRY_DELAY_MS = originalDelay;
                if (originalRetries === undefined) delete process.env.POSTGRES_CONNECT_RETRIES;
                else process.env.POSTGRES_CONNECT_RETRIES = originalRetries;
            }
        });

        it('retries connection acquisition for withTransaction()', async () => {
            const originalDelay = process.env.POSTGRES_CONNECT_RETRY_DELAY_MS;
            process.env.POSTGRES_CONNECT_RETRY_DELAY_MS = '0';
            try {
                const mockClient = {
                    query: jest.fn().mockResolvedValue({}),
                    release: jest.fn()
                };
                const connect = jest.fn()
                    .mockRejectedValueOnce(new Error(TRANSIENT_MESSAGE))
                    .mockResolvedValueOnce(mockClient);
                const { db } = await loadDatabaseModule({ pool: { connect } });

                const result = await db.withTransaction(async () => 'done');

                expect(connect).toHaveBeenCalledTimes(2);
                expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
                expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
                expect(result).toBe('done');
            } finally {
                if (originalDelay === undefined) delete process.env.POSTGRES_CONNECT_RETRY_DELAY_MS;
                else process.env.POSTGRES_CONNECT_RETRY_DELAY_MS = originalDelay;
            }
        });
    });

    describe('Slow Query Logging', () => {
        let warnSpy;

        beforeEach(() => {
            warnSpy = createConsoleSpy('warn', { suppress: true });
        });

        afterEach(() => {
            warnSpy.restore();
        });

        it('does not log for fast queries', async () => {
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            await db.query('SELECT 1');
            expect(warnSpy.spy).not.toHaveBeenCalled();
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('logs [SLOW QUERY] when query exceeds threshold', async () => {
            process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS = '-1';
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient),
                    totalCount: 15,
                    idleCount: 4,
                    waitingCount: 2,
                }
            });
            await db.query('SELECT slow_thing FROM table');
            expect(warnSpy.spy).toHaveBeenCalledWith(expect.stringContaining('[SLOW QUERY]'));
            expect(warnSpy.spy).toHaveBeenCalledWith(expect.stringContaining('total='));
            expect(warnSpy.spy).toHaveBeenCalledWith(expect.stringContaining('poolWait='));
            expect(warnSpy.spy).toHaveBeenCalledWith(expect.stringContaining('exec='));
            expect(warnSpy.spy).toHaveBeenCalledWith(expect.stringContaining('pool total=15 idle=4 waiting=2'));
            expect(mockClient.release).toHaveBeenCalled();
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
        });

        it('truncates long query text to 120 characters', async () => {
            process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS = '-1';
            const longQuery = 'SELECT ' + 'a'.repeat(300) + ' FROM t';
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            await db.query(longQuery);
            expect(warnSpy.spy).toHaveBeenCalled();
            const warnCall = warnSpy.spy.mock.calls[0][0];
            const queryPart = warnCall.split('— ')[1].split(' {')[0];
            expect(queryPart.length).toBeLessThanOrEqual(120);
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
        });

        it('POSTGRES_SLOW_QUERY_THRESHOLD_MS env var controls threshold', async () => {
            process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS = '999999';
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            await db.query('SELECT 1');
            expect(warnSpy.spy).not.toHaveBeenCalled();
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
        });
    });

    describe('tryAdvisoryLock()', () => {
        it('exports tryAdvisoryLock function and DB_ADVISORY_LOCKS constants', async () => {
            const { db } = await loadDatabaseModule();
            expect(typeof db.tryAdvisoryLock).toBe('function');
            expect(db.DB_ADVISORY_LOCKS).toBeDefined();
        });

        it('returns true when lock is acquired', async () => {
            const { db } = await loadDatabaseModule();
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            };
            const result = await db.tryAdvisoryLock(mockClient, 1001);
            expect(result).toBe(true);
        });

        it('returns false when lock is already held', async () => {
            const { db } = await loadDatabaseModule();
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] })
            };
            const result = await db.tryAdvisoryLock(mockClient, 1001);
            expect(result).toBe(false);
        });

        it('DB_ADVISORY_LOCKS includes receipt retention alongside existing maintenance lock keys', async () => {
            const { db } = await loadDatabaseModule();
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('IDLE_BACKFILL', 1001);
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('SCHEDULED_BACKFILL', 1002);
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('MANUAL_BACKFILL', 1003);
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('BACKFILL_OWNER', 1004);
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('TASK_QUEUE_MAINTENANCE', 2012);
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION', 2013);
        });
    });

    describe('withSessionAdvisoryLock()', () => {
        it('exports withSessionAdvisoryLock function', async () => {
            const { db } = await loadDatabaseModule();
            expect(typeof db.withSessionAdvisoryLock).toBe('function');
        });

        it('calls fn and returns true when lock is acquired', async () => {
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [{ acquired: true }] })
                    .mockResolvedValueOnce({}),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            const fn = jest.fn().mockResolvedValue('done');
            const result = await db.withSessionAdvisoryLock(1001, fn);
            expect(result).toBe(true);
            expect(fn).toHaveBeenCalled();
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('skips fn and returns false when lock is not acquired', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            const fn = jest.fn();
            const result = await db.withSessionAdvisoryLock(1001, fn);
            expect(result).toBe(false);
            expect(fn).not.toHaveBeenCalled();
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('releases lock and client even when fn throws', async () => {
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [{ acquired: true }] })
                    .mockResolvedValueOnce({}),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            const fn = jest.fn().mockRejectedValue(new Error('fn error'));
            await expect(db.withSessionAdvisoryLock(1001, fn)).rejects.toThrow('fn error');
            expect(mockClient.release).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [1001]);
        });
    });

    describe('prewarmHnswIndexes()', () => {
        it('returns prewarmed block counts when indexes exist', async () => {
            const { db, pool } = await loadDatabaseModule({
                pool: {
                    query: jest.fn().mockResolvedValue({
                        rows: [{ text_blocks: '12', image_blocks: '34' }]
                    })
                }
            });

            const result = await db.prewarmHnswIndexes();

            expect(result).toEqual({
                loaded: true,
                blocks: {
                    text: 12,
                    image: 34,
                },
            });
            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("to_regclass('public.idx_embeddings_hnsw')"));
            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("pg_prewarm('public.idx_embeddings_image_hnsw')"));
        });

        it('returns loaded false when prewarm query fails', async () => {
            const { db } = await loadDatabaseModule({
                pool: {
                    query: jest.fn().mockRejectedValue(new Error('pg_prewarm unavailable'))
                }
            });

            const result = await db.prewarmHnswIndexes();

            expect(result).toEqual({
                loaded: false,
                error: 'pg_prewarm unavailable',
            });
        });
    });

    describe('POSTGRES_SLOW_QUERY_THRESHOLD_MS NaN handling', () => {
        it('falls back to 500ms when env var is a non-numeric string', async () => {
            process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS = 'not-a-number';
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            await db.query('SELECT 1');
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
        });
    });

    describe('withTransaction() rollback error logging', () => {
        it('logs rollback errors to logger.error', async () => {
            const mockLoggerError = jest.fn();
            const mockLoggerModule = {
                createLogger: jest.fn(() => ({
                    info: jest.fn(),
                    warn: jest.fn(),
                    error: mockLoggerError,
                    debug: jest.fn(),
                }))
            };
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({})
                    .mockRejectedValueOnce(new Error('fn failed'))
                    .mockRejectedValueOnce(new Error('rollback error')),
                release: jest.fn()
            };
            const { db } = await loadDatabaseModule({
                loggerModule: mockLoggerModule,
                pool: {
                    connect: jest.fn().mockResolvedValue(mockClient)
                }
            });
            try {
                await expect(db.withTransaction(jest.fn().mockRejectedValue(new Error('fn failed')))).rejects.toThrow('fn failed');
                expect(mockLoggerError).toHaveBeenCalledWith(
                    'Failed to rollback transaction',
                    expect.objectContaining({ rollbackError: expect.any(String) })
                );
            } finally {
            }
        });
    });
});
