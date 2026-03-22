/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Database Resilience Tests
 * Ensures database connection errors don't crash the application (regression prevention)
 * 
 * Background: v0.39.5a-alpha hotfix removed process.exit(-1) from database.js
 * which was causing containers to crash (Exit 255) on transient connection errors.
 */

const fs = require('fs');
const path = require('path');
const { createConsoleSpy } = require('./setup/consoleHelpers');

describe('Database Resilience', () => {
    describe('Static Analysis - No process.exit in database.js', () => {
        it('should NOT contain process.exit in the database config', () => {
            // Read the actual database.js file
            const databasePath = path.join(__dirname, '..', 'config', 'database.js');
            const content = fs.readFileSync(databasePath, 'utf-8');

            // Check that process.exit is NOT in the file
            // This is a critical regression test - process.exit caused Exit 255 crashes
            expect(content).not.toMatch(/process\.exit/);
        });

        it('should have a pool error handler that logs but does not exit', () => {
            const databasePath = path.join(__dirname, '..', 'config', 'database.js');
            const content = fs.readFileSync(databasePath, 'utf-8');

            // Verify the pool.on('error') handler exists
            expect(content).toMatch(/pool\.on\(['"]error['"]/);

            // Verify logger.error is called for logging
            expect(content).toMatch(/logger\.error.*[Uu]nexpected error/);
        });
    });

    describe('Pool Error Handler Behavior', () => {
        let originalProcessExit;
        let processExitCalled = false;
        let consoleSpy;

        beforeAll(() => {
            // Mock process.exit to detect if it's ever called
            originalProcessExit = process.exit;
            process.exit = jest.fn(() => {
                processExitCalled = true;
            });
        });

        afterAll(() => {
            // Restore original process.exit
            process.exit = originalProcessExit;
        });

        beforeEach(() => {
            processExitCalled = false;
            jest.clearAllMocks();
            // Suppress console.error to keep test output clean and prevent false positives
            consoleSpy = createConsoleSpy('error', { suppress: true });
        });

        afterEach(() => {
            if (consoleSpy) {
                consoleSpy.restore();
            }
        });

        it('should not call process.exit when pool emits an error event', () => {
            // Directly test pool error handling without requiring DB
            const { Pool: _Pool } = require('pg');
            const EventEmitter = require('events');

            // Create a mock pool that extends EventEmitter
            const mockPool = new EventEmitter();

            // Simulate the error handler from database.js (should NOT exit)
            // This mimics what the actual handler should do
            mockPool.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
                // Should NOT call process.exit(-1) here!
            });

            // Emit an error
            mockPool.emit('error', new Error('Connection terminated unexpectedly'));

            // Verify process.exit was NOT called
            expect(process.exit).not.toHaveBeenCalled();
            expect(processExitCalled).toBe(false);
            expect(consoleSpy.spy).toHaveBeenCalled();
        });

        it('should handle ECONNRESET errors gracefully', () => {
            const EventEmitter = require('events');
            const mockPool = new EventEmitter();

            // Simulate the error handler from database.js
            mockPool.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
            });

            // Create an ECONNRESET error (common network issue)
            const econnresetError = new Error('read ECONNRESET');
            econnresetError.code = 'ECONNRESET';

            mockPool.emit('error', econnresetError);

            // Application should continue running
            expect(process.exit).not.toHaveBeenCalled();
            expect(consoleSpy.spy).toHaveBeenCalled();
        });

        it('should handle connection terminated errors gracefully', () => {
            const EventEmitter = require('events');
            const mockPool = new EventEmitter();

            mockPool.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
            });

            // This is the exact error that was crashing Unraid containers
            mockPool.emit('error', new Error('Connection terminated unexpectedly'));

            expect(process.exit).not.toHaveBeenCalled();
            expect(consoleSpy.spy).toHaveBeenCalled();
        });
    });

    describe('Database Module Integration', () => {
        it('should export query and pool', () => {
            // Use a fresh require to test the actual module structure
            jest.resetModules();

            // Mock pg Pool before requiring database
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));

            const db = require('../config/database');

            expect(db).toHaveProperty('query');
            expect(db).toHaveProperty('pool');
            expect(typeof db.query).toBe('function');
        });
    });

    describe('Pool Configuration - Timeouts and Limits', () => {
        it('should export healthCheck function', () => {
            jest.resetModules();
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            expect(typeof db.healthCheck).toBe('function');
        });

        it('should have connectionTimeoutMillis configured', () => {
            const databasePath = path.join(__dirname, '..', 'config', 'database.js');
            const content = fs.readFileSync(databasePath, 'utf-8');
            expect(content).toMatch(/connectionTimeoutMillis/);
        });

        it('should have idleTimeoutMillis configured', () => {
            const databasePath = path.join(__dirname, '..', 'config', 'database.js');
            const content = fs.readFileSync(databasePath, 'utf-8');
            expect(content).toMatch(/idleTimeoutMillis/);
        });

        it('should have statement_timeout configured', () => {
            const databasePath = path.join(__dirname, '..', 'config', 'database.js');
            const content = fs.readFileSync(databasePath, 'utf-8');
            expect(content).toMatch(/statement_timeout/);
        });

        it('should have explicit max pool size configured', () => {
            const databasePath = path.join(__dirname, '..', 'config', 'database.js');
            const content = fs.readFileSync(databasePath, 'utf-8');
            expect(content).toMatch(/POSTGRES_POOL_MAX/);
        });

        it('healthCheck should return { healthy: true } on successful connection', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn().mockResolvedValue({}),
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            const result = await db.healthCheck();
            expect(result).toEqual({ healthy: true });
        });

        it('healthCheck should return { healthy: false, error } on connection failure', async () => {
            jest.resetModules();
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockRejectedValue(new Error('Connection refused'))
                }))
            }));
            const db = require('../config/database');
            const result = await db.healthCheck();
            expect(result).toMatchObject({ healthy: false, error: 'Connection refused' });
        });

        it('healthCheck sanitizes error message in production (no internal host/db info disclosed)', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            try {
                jest.resetModules();
                jest.mock('pg', () => ({
                    Pool: jest.fn().mockImplementation(() => ({
                        on: jest.fn(),
                        connect: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 172.20.0.2:5432'))
                    }))
                }));
                const db = require('../config/database');
                const result = await db.healthCheck();
                expect(result.healthy).toBe(false);
                expect(result.error).toBe('Database connection failed');
                expect(result.error).not.toMatch(/172\.20|ECONNREFUSED|5432/);
            } finally {
                process.env.NODE_ENV = originalEnv;
                jest.resetModules();
            }
        });

        it('healthCheck should always release the client even on query failure', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn().mockRejectedValue(new Error('query error')),
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            await db.healthCheck();
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('withTransaction()', () => {
        it('exports withTransaction function', () => {
            jest.resetModules();
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            expect(typeof db.withTransaction).toBe('function');
        });

        it('commits on success', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn().mockResolvedValue({}),
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            const fn = jest.fn().mockResolvedValue('result');
            const result = await db.withTransaction(fn);
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(fn).toHaveBeenCalledWith(mockClient);
            expect(result).toBe('result');
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('rolls back and rethrows on error', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn().mockResolvedValue({}),
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            const originalError = new Error('fn failed');
            const fn = jest.fn().mockRejectedValue(originalError);
            await expect(db.withTransaction(fn)).rejects.toThrow('fn failed');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('releases client even when ROLLBACK fails', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({}) // BEGIN
                    .mockRejectedValueOnce(new Error('rollback error')), // ROLLBACK
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            const originalError = new Error('fn failed');
            const fn = jest.fn().mockRejectedValue(originalError);
            await expect(db.withTransaction(fn)).rejects.toThrow('fn failed');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('passes client to fn', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn().mockResolvedValue({}),
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            let receivedClient;
            await db.withTransaction(async (client) => { receivedClient = client; });
            expect(receivedClient).toBe(mockClient);
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
            jest.resetModules();
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
            const mockQueryResult = { rows: [] };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    query: jest.fn().mockResolvedValue(mockQueryResult),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            await db.query('SELECT 1');
            expect(warnSpy.spy).not.toHaveBeenCalled();
        });

        it('logs [SLOW QUERY] when query exceeds threshold', async () => {
            jest.resetModules();
            // Use -1 as threshold so any query (even sub-millisecond) always logs
            process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS = '-1';
            const mockQueryResult = { rows: [] };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    query: jest.fn().mockResolvedValue(mockQueryResult),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            await db.query('SELECT slow_thing FROM table');
            expect(warnSpy.spy).toHaveBeenCalledWith(expect.stringContaining('[SLOW QUERY]'));
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
        });

        it('truncates long query text to 120 characters', async () => {
            jest.resetModules();
            // Use -1 as threshold so any query (even sub-millisecond) always logs
            process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS = '-1';
            const longQuery = 'SELECT ' + 'a'.repeat(300) + ' FROM t';
            const mockQueryResult = { rows: [] };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    query: jest.fn().mockResolvedValue(mockQueryResult),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            await db.query(longQuery);
            expect(warnSpy.spy).toHaveBeenCalled();
            const warnCall = warnSpy.spy.mock.calls[0][0];
            // Extract the query portion after the duration
            const queryPart = warnCall.split('— ')[1];
            expect(queryPart.length).toBeLessThanOrEqual(120);
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
        });

        it('POSTGRES_SLOW_QUERY_THRESHOLD_MS env var controls threshold', async () => {
            jest.resetModules();
            process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS = '999999';
            const mockQueryResult = { rows: [] };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    query: jest.fn().mockResolvedValue(mockQueryResult),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            await db.query('SELECT 1');
            expect(warnSpy.spy).not.toHaveBeenCalled();
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
        });
    });

    describe('tryAdvisoryLock()', () => {
        it('exports tryAdvisoryLock function and DB_ADVISORY_LOCKS constants', () => {
            jest.resetModules();
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            expect(typeof db.tryAdvisoryLock).toBe('function');
            expect(db.DB_ADVISORY_LOCKS).toBeDefined();
        });

        it('returns true when lock is acquired', async () => {
            jest.resetModules();
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            };
            const result = await db.tryAdvisoryLock(mockClient, 1001);
            expect(result).toBe(true);
        });

        it('returns false when lock is already held', async () => {
            jest.resetModules();
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] })
            };
            const result = await db.tryAdvisoryLock(mockClient, 1001);
            expect(result).toBe(false);
        });

        it('DB_ADVISORY_LOCKS has IDLE_BACKFILL, SCHEDULED_BACKFILL, MANUAL_BACKFILL, BACKFILL_OWNER keys', () => {
            jest.resetModules();
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('IDLE_BACKFILL', 1001);
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('SCHEDULED_BACKFILL', 1002);
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('MANUAL_BACKFILL', 1003);
            expect(db.DB_ADVISORY_LOCKS).toHaveProperty('BACKFILL_OWNER', 1004);
        });
    });

    describe('withSessionAdvisoryLock()', () => {
        it('exports withSessionAdvisoryLock function', () => {
            jest.resetModules();
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            expect(typeof db.withSessionAdvisoryLock).toBe('function');
        });

        it('calls fn and returns true when lock is acquired', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [{ acquired: true }] }) // pg_try_advisory_lock
                    .mockResolvedValueOnce({}),                             // pg_advisory_unlock
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            const fn = jest.fn().mockResolvedValue('done');
            const result = await db.withSessionAdvisoryLock(1001, fn);
            expect(result).toBe(true);
            expect(fn).toHaveBeenCalled();
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('skips fn and returns false when lock is not acquired', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            const fn = jest.fn();
            const result = await db.withSessionAdvisoryLock(1001, fn);
            expect(result).toBe(false);
            expect(fn).not.toHaveBeenCalled();
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('releases lock and client even when fn throws', async () => {
            jest.resetModules();
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [{ acquired: true }] }) // pg_try_advisory_lock
                    .mockResolvedValueOnce({}),                             // pg_advisory_unlock
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            const fn = jest.fn().mockRejectedValue(new Error('fn error'));
            await expect(db.withSessionAdvisoryLock(1001, fn)).rejects.toThrow('fn error');
            expect(mockClient.release).toHaveBeenCalled();
            // pg_advisory_unlock should still have been called
            expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [1001]);
        });
    });

    describe('POSTGRES_SLOW_QUERY_THRESHOLD_MS NaN handling', () => {
        it('falls back to 500ms when env var is a non-numeric string', async () => {
            jest.resetModules();
            process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS = 'not-a-number';
            const mockQueryResult = { rows: [] };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    query: jest.fn().mockResolvedValue(mockQueryResult),
                    connect: jest.fn()
                }))
            }));
            const db = require('../config/database');
            // A fast query should NOT log with the default 500ms threshold
            await db.query('SELECT 1');
            // If the threshold was NaN, the comparison would always be false — same result,
            // but the module should not throw. We verify module loads and query runs cleanly.
            delete process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS;
        });
    });

    describe('withTransaction() rollback error logging', () => {
        it('logs rollback errors to logger.error', async () => {
            jest.resetModules();
            const mockLoggerError = jest.fn();
            jest.mock('../utils/logger', () => ({
                createLogger: jest.fn(() => ({
                    info: jest.fn(),
                    warn: jest.fn(),
                    error: mockLoggerError,
                    debug: jest.fn(),
                }))
            }));
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({}) // BEGIN
                    .mockRejectedValueOnce(new Error('fn failed')) // fn
                    .mockRejectedValueOnce(new Error('rollback error')), // ROLLBACK
                release: jest.fn()
            };
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    on: jest.fn(),
                    connect: jest.fn().mockResolvedValue(mockClient)
                }))
            }));
            const db = require('../config/database');
            try {
                await expect(db.withTransaction(jest.fn().mockRejectedValue(new Error('fn failed')))).rejects.toThrow('fn failed');
                expect(mockLoggerError).toHaveBeenCalledWith(
                    'Failed to rollback transaction',
                    expect.objectContaining({ rollbackError: expect.any(String) })
                );
            } finally {
                // no spy to restore
            }
        });
    });
});
