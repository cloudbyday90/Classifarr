/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const dbModule = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', dbModule));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }),
}));

const { QueueMaintenanceService } = await import('../services/queueMaintenanceService.mjs');

const STATUS_SETTING_KEYS = Object.freeze({
    completed: 'task_queue_retention_days',
    failed: 'task_queue_failed_retention_days',
    cancelled: 'task_queue_cancelled_retention_days',
});

function defaultOldest(overrides = {}) {
    return {
        completed: overrides.completed ?? '2026-05-01T00:00:00.000Z',
        failed: overrides.failed ?? '2026-04-01T00:00:00.000Z',
        cancelled: overrides.cancelled ?? '2026-05-10T00:00:00.000Z',
    };
}

describe('QueueMaintenanceService', () => {
    let db;
    let logger;
    let service;
    let withSessionAdvisoryLock;

    beforeEach(() => {
        jest.resetAllMocks();
        db = { query: jest.fn() };
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        withSessionAdvisoryLock = jest.fn(async (_lockKey, handler) => {
            await handler();
            return true;
        });
        service = new QueueMaintenanceService({
            db,
            logger,
            withSessionAdvisoryLock,
            taskQueueMaintenanceLockKey: 2012,
        });
    });

    function mockRetentionSettings(overrides = {}) {
        const rows = Object.entries(STATUS_SETTING_KEYS)
            .flatMap(([status, key]) => {
                const value = overrides[status];
                return value === undefined ? [] : [{ key, value }];
            });

        db.query.mockResolvedValueOnce({ rows });
    }

    function mockTerminalCounts({
        completed = { stale: 0, total: 0 },
        failed = { stale: 0, total: 0 },
        cancelled = { stale: 0, total: 0 },
        oldest = defaultOldest(),
    } = {}) {
        db.query.mockResolvedValueOnce({
            rows: [{
                stale_completed: String(completed.stale),
                total_completed: String(completed.total),
                oldest_completed: oldest.completed,
                stale_failed: String(failed.stale),
                total_failed: String(failed.total),
                oldest_failed: oldest.failed,
                stale_cancelled: String(cancelled.stale),
                total_cancelled: String(cancelled.total),
                oldest_cancelled: oldest.cancelled,
            }],
        });
    }

    function mockRecentCapTrimSummary({
        runs = 0,
        rows = 0,
        lastTrimAt = null,
    } = {}) {
        db.query.mockResolvedValueOnce({
            rows: [{
                cap_trim_runs_last_24h: String(runs),
                cap_trim_rows_last_24h: String(rows),
                last_cap_trim_at: lastTrimAt,
            }],
        });
    }

    function mockCleanupHistoryInsert() {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
    }

    function getDeleteCalls() {
        return db.query.mock.calls.filter(
            ([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM task_queue')
        );
    }

    function getCleanupHistoryInsertCalls() {
        return db.query.mock.calls.filter(
            ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO task_queue_cleanup_history')
        );
    }

    describe('backgroundDrainIfBloated', () => {
        test('returns early when neither age nor count threshold is exceeded', async () => {
            mockRetentionSettings({
                completed: '7',
                failed: '30',
                cancelled: '3',
            });
            mockTerminalCounts({
                completed: { stale: 0, total: 200 },
                failed: { stale: 0, total: 50 },
                cancelled: { stale: 0, total: 10 },
            });

            await service.backgroundDrainIfBloated();

            expect(db.query).toHaveBeenCalledTimes(2);
            expect(logger.warn).not.toHaveBeenCalled();
        });

        test('deletes stale rows using status-specific retention windows, records history, and runs vacuum', async () => {
            mockRetentionSettings({
                completed: '7',
                failed: '30',
                cancelled: '3',
            });
            mockTerminalCounts({
                completed: { stale: 1500, total: 1500 },
                failed: { stale: 2000, total: 2000 },
                cancelled: { stale: 500, total: 500 },
            });
            db.query
                .mockResolvedValueOnce({ rowCount: 500 })
                .mockResolvedValueOnce({ rowCount: 1500 })
                .mockResolvedValueOnce({ rowCount: 2000 });
            mockTerminalCounts();
            mockCleanupHistoryInsert();
            db.query.mockResolvedValueOnce({});

            await service.backgroundDrainIfBloated();

            const deleteStatuses = getDeleteCalls().map(([, params]) => params[0]);
            expect(deleteStatuses).toEqual(['cancelled', 'completed', 'failed']);
            expect(logger.info).toHaveBeenCalledWith(
                'task_queue retention backlog detected at worker startup; running background drain',
                expect.objectContaining({
                    cleanupOrigin: 'worker_startup',
                    trigger: 'age',
                    oldestRowsByStatus: expect.objectContaining({
                        failed: '2026-04-01T00:00:00.000Z',
                    }),
                })
            );
            expect(logger.info).toHaveBeenCalledWith(
                'Background task_queue drain complete',
                expect.objectContaining({
                    deleted: 4000,
                    ageDeleted: 4000,
                    countCapDeleted: 0,
                    ageDeletedByStatus: { cancelled: 500, completed: 1500, failed: 2000 },
                })
            );
            expect(getCleanupHistoryInsertCalls()).toHaveLength(1);
            expect(getCleanupHistoryInsertCalls()[0][1][1]).toBe('worker_startup');
        });

        test('trims count cap in cancelled-then-completed-then-failed order and logs recurrence telemetry', async () => {
            mockRetentionSettings({
                completed: '0',
                failed: '0',
                cancelled: '0',
            });
            mockTerminalCounts({
                completed: { stale: 0, total: 100000 },
                failed: { stale: 0, total: 140000 },
                cancelled: { stale: 0, total: 60000 },
            });
            mockRecentCapTrimSummary({
                runs: 2,
                rows: 52000,
                lastTrimAt: '2026-05-14T06:00:00.000Z',
            });
            db.query
                .mockResolvedValueOnce({ rowCount: 60000 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 40000 });
            mockTerminalCounts({
                completed: { stale: 0, total: 60000 },
                failed: { stale: 0, total: 140000 },
                cancelled: { stale: 0, total: 0 },
                oldest: defaultOldest({ cancelled: null }),
            });
            mockCleanupHistoryInsert();
            db.query.mockResolvedValueOnce({});

            await service.backgroundDrainIfBloated();

            const countTrimCalls = getDeleteCalls().map(([, params]) => params[0]);
            expect(countTrimCalls).toEqual(['cancelled', 'cancelled', 'completed']);
            expect(logger.warn).toHaveBeenCalledWith(
                'task_queue capacity pressure detected at worker startup; running background drain',
                expect.objectContaining({
                    cleanupOrigin: 'worker_startup',
                    trigger: 'count',
                })
            );
            expect(logger.warn).toHaveBeenCalledWith(
                'task_queue count cap exceeded; trimming oldest rows',
                expect.objectContaining({
                    remaining: 300000,
                    toDelete: 100000,
                    capTrimRunsLast24h: 2,
                    capTrimRowsLast24h: 52000,
                    lastCapTrimAt: '2026-05-14T06:00:00.000Z',
                })
            );
            expect(logger.info).toHaveBeenCalledWith(
                'Background task_queue drain complete',
                expect.objectContaining({
                    countCapDeleted: 100000,
                    countCapDeletedByStatus: { cancelled: 60000, completed: 40000, failed: 0 },
                })
            );
            expect(getCleanupHistoryInsertCalls()).toHaveLength(1);
        });

        test('skips without querying when another process owns the maintenance advisory lock', async () => {
            withSessionAdvisoryLock.mockResolvedValueOnce(false);

            await expect(service.backgroundDrainIfBloated()).resolves.toEqual({
                status: 'skipped',
                cleanupOrigin: 'worker_startup',
                reason: 'advisory_lock_held',
            });

            expect(withSessionAdvisoryLock).toHaveBeenCalledWith(2012, expect.any(Function));
            expect(db.query).not.toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith(
                'task_queue cleanup skipped because another process holds the advisory lock',
                expect.objectContaining({ cleanupOrigin: 'worker_startup', lockKey: 2012 })
            );
        });

        test('skips a second local cleanup while the first is in flight', async () => {
            let releaseFirstCleanup;
            const firstCleanupStarted = new Promise(resolve => {
                releaseFirstCleanup = resolve;
            });
            const executeCleanup = jest.fn(() => firstCleanupStarted);

            const firstRun = service.runSerializedCleanup('worker_startup', executeCleanup);
            await Promise.resolve();

            await expect(
                service.runSerializedCleanup('cron', executeCleanup)
            ).resolves.toEqual({
                status: 'skipped',
                cleanupOrigin: 'cron',
                reason: 'local_in_flight',
            });

            expect(executeCleanup).toHaveBeenCalledTimes(1);
            expect(withSessionAdvisoryLock).toHaveBeenCalledTimes(1);

            releaseFirstCleanup();
            await expect(firstRun).resolves.toBeUndefined();
        });

        test('uses database settings ahead of env fallback for all terminal statuses', async () => {
            const previousCompleted = process.env.TASK_QUEUE_RETENTION_DAYS;
            const previousFailed = process.env.TASK_QUEUE_FAILED_RETENTION_DAYS;
            const previousCancelled = process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS;
            process.env.TASK_QUEUE_RETENTION_DAYS = '20';
            process.env.TASK_QUEUE_FAILED_RETENTION_DAYS = '40';
            process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS = '5';

            try {
                mockRetentionSettings({
                    completed: '14',
                    failed: '45',
                    cancelled: '2',
                });
                mockTerminalCounts();

                await service.backgroundDrainIfBloated();

                expect(db.query).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('stale_completed'),
                    [14, 45, 2, ['cancelled', 'completed', 'failed']]
                );
            } finally {
                if (previousCompleted === undefined) delete process.env.TASK_QUEUE_RETENTION_DAYS;
                else process.env.TASK_QUEUE_RETENTION_DAYS = previousCompleted;
                if (previousFailed === undefined) delete process.env.TASK_QUEUE_FAILED_RETENTION_DAYS;
                else process.env.TASK_QUEUE_FAILED_RETENTION_DAYS = previousFailed;
                if (previousCancelled === undefined) delete process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS;
                else process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS = previousCancelled;
            }
        });

        test('skips stale-failed deletion when failed retention is disabled', async () => {
            mockRetentionSettings({
                completed: '7',
                failed: '0',
                cancelled: '3',
            });
            mockTerminalCounts({
                completed: { stale: 1500, total: 1500 },
                failed: { stale: 1200, total: 1200 },
                cancelled: { stale: 0, total: 0 },
            });
            db.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1500 });
            mockTerminalCounts({
                completed: { stale: 0, total: 0 },
                failed: { stale: 1200, total: 1200 },
                cancelled: { stale: 0, total: 0 },
            });
            mockCleanupHistoryInsert();
            db.query.mockResolvedValueOnce({});

            await service.backgroundDrainIfBloated();

            const deleteStatuses = getDeleteCalls().map(([, params]) => params[0]);
            expect(deleteStatuses).toEqual(['cancelled', 'completed']);
            expect(deleteStatuses).not.toContain('failed');
        });

        test('falls back to env retention settings when settings lookup fails', async () => {
            const previousCompleted = process.env.TASK_QUEUE_RETENTION_DAYS;
            const previousFailed = process.env.TASK_QUEUE_FAILED_RETENTION_DAYS;
            const previousCancelled = process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS;
            process.env.TASK_QUEUE_RETENTION_DAYS = '21';
            process.env.TASK_QUEUE_FAILED_RETENTION_DAYS = '45';
            process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS = '2';

            try {
                db.query
                    .mockRejectedValueOnce(new Error('settings missing'))
                    .mockResolvedValueOnce({
                        rows: [{
                            stale_completed: '0',
                            total_completed: '0',
                            oldest_completed: null,
                            stale_failed: '0',
                            total_failed: '0',
                            oldest_failed: null,
                            stale_cancelled: '0',
                            total_cancelled: '0',
                            oldest_cancelled: null,
                        }],
                    });

                await service.backgroundDrainIfBloated();

                expect(logger.debug).toHaveBeenCalledWith(
                    'Task queue retention settings lookup failed; falling back to env/default',
                    expect.objectContaining({ error: 'settings missing' })
                );
                expect(db.query).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('stale_completed'),
                    [21, 45, 2, ['cancelled', 'completed', 'failed']]
                );
            } finally {
                if (previousCompleted === undefined) delete process.env.TASK_QUEUE_RETENTION_DAYS;
                else process.env.TASK_QUEUE_RETENTION_DAYS = previousCompleted;
                if (previousFailed === undefined) delete process.env.TASK_QUEUE_FAILED_RETENTION_DAYS;
                else process.env.TASK_QUEUE_FAILED_RETENTION_DAYS = previousFailed;
                if (previousCancelled === undefined) delete process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS;
                else process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS = previousCancelled;
            }
        });
    });

    describe('getTaskQueueMaxTotalRows', () => {
        test('returns 200000 by default (no env var)', () => {
            const previous = process.env.TASK_QUEUE_MAX_TOTAL_ROWS;
            delete process.env.TASK_QUEUE_MAX_TOTAL_ROWS;
            try {
                expect(service.getTaskQueueMaxTotalRows()).toBe(200000);
            } finally {
                if (previous !== undefined) process.env.TASK_QUEUE_MAX_TOTAL_ROWS = previous;
            }
        });

        test('respects TASK_QUEUE_MAX_TOTAL_ROWS env var override', () => {
            const previous = process.env.TASK_QUEUE_MAX_TOTAL_ROWS;
            process.env.TASK_QUEUE_MAX_TOTAL_ROWS = '500000';
            try {
                expect(service.getTaskQueueMaxTotalRows()).toBe(500000);
            } finally {
                if (previous === undefined) delete process.env.TASK_QUEUE_MAX_TOTAL_ROWS;
                else process.env.TASK_QUEUE_MAX_TOTAL_ROWS = previous;
            }
        });
    });

    describe('runScheduledTaskQueueCleanup', () => {
        test('no-ops when no rows qualify for cleanup', async () => {
            mockRetentionSettings({
                completed: '7',
                failed: '30',
                cancelled: '3',
            });
            mockTerminalCounts({
                completed: { stale: 0, total: 500 },
                failed: { stale: 0, total: 100 },
                cancelled: { stale: 0, total: 20 },
            });
            db.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 });
            mockTerminalCounts({
                completed: { stale: 0, total: 500 },
                failed: { stale: 0, total: 100 },
                cancelled: { stale: 0, total: 20 },
            });

            await service.runScheduledTaskQueueCleanup();

            const vacuumCall = db.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes('VACUUM ANALYZE task_queue')
            );
            expect(vacuumCall).toBeUndefined();
            expect(getCleanupHistoryInsertCalls()).toHaveLength(0);
            expect(logger.debug).toHaveBeenCalledWith(
                'Task queue cleanup: no rows to delete',
                expect.objectContaining({
                    retentionDays: { completed: 7, failed: 30, cancelled: 3 },
                    oldestRowsByStatus: expect.objectContaining({
                        completed: '2026-05-01T00:00:00.000Z',
                    }),
                })
            );
        });

        test('scheduled cleanup trims oldest rows in status priority order, records history, and vacuums once', async () => {
            mockRetentionSettings({
                completed: '7',
                failed: '30',
                cancelled: '3',
            });
            mockTerminalCounts({
                completed: { stale: 0, total: 100000 },
                failed: { stale: 0, total: 140000 },
                cancelled: { stale: 0, total: 60000 },
            });
            db.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 });
            mockTerminalCounts({
                completed: { stale: 0, total: 100000 },
                failed: { stale: 0, total: 140000 },
                cancelled: { stale: 0, total: 60000 },
            });
            mockRecentCapTrimSummary({
                runs: 1,
                rows: 24000,
                lastTrimAt: '2026-05-13T03:15:00.000Z',
            });
            db.query
                .mockResolvedValueOnce({ rowCount: 60000 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 40000 });
            mockTerminalCounts({
                completed: { stale: 0, total: 60000 },
                failed: { stale: 0, total: 140000 },
                cancelled: { stale: 0, total: 0 },
                oldest: defaultOldest({ cancelled: null }),
            });
            mockCleanupHistoryInsert();
            db.query.mockResolvedValueOnce({});

            await service.runScheduledTaskQueueCleanup();

            const deleteStatuses = getDeleteCalls().map(([, params]) => params[0]);
            expect(deleteStatuses).toEqual(['cancelled', 'completed', 'failed', 'cancelled', 'cancelled', 'completed']);
            expect(logger.warn).toHaveBeenCalledWith(
                'task_queue count cap exceeded during scheduled cleanup; trimming oldest rows',
                expect.objectContaining({
                    remaining: 300000,
                    toDelete: 100000,
                    capTrimRunsLast24h: 1,
                    capTrimRowsLast24h: 24000,
                })
            );
            expect(logger.info).toHaveBeenCalledWith(
                'Task queue cleanup complete',
                expect.objectContaining({
                    deleted: 100000,
                    countCapDeletedByStatus: { cancelled: 60000, completed: 40000, failed: 0 },
                    rowsBefore: expect.objectContaining({ total: 300000 }),
                })
            );
            expect(getCleanupHistoryInsertCalls()).toHaveLength(1);
            expect(getCleanupHistoryInsertCalls()[0][1][1]).toBe('cron');
            const vacuumCalls = db.query.mock.calls.filter(
                ([sql]) => typeof sql === 'string' && sql.includes('VACUUM ANALYZE task_queue')
            );
            expect(vacuumCalls).toHaveLength(1);
        });

        test('uses database settings before env fallback during scheduled cleanup', async () => {
            const previousCompleted = process.env.TASK_QUEUE_RETENTION_DAYS;
            const previousFailed = process.env.TASK_QUEUE_FAILED_RETENTION_DAYS;
            const previousCancelled = process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS;
            process.env.TASK_QUEUE_RETENTION_DAYS = '20';
            process.env.TASK_QUEUE_FAILED_RETENTION_DAYS = '40';
            process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS = '5';

            try {
                mockRetentionSettings({
                    completed: '14',
                    failed: '45',
                    cancelled: '2',
                });
                mockTerminalCounts();
                db.query
                    .mockResolvedValueOnce({ rowCount: 0 })
                    .mockResolvedValueOnce({ rowCount: 0 })
                    .mockResolvedValueOnce({ rowCount: 0 });
                mockTerminalCounts();

                await service.runScheduledTaskQueueCleanup();

                const completedDeleteCall = getDeleteCalls().find(([, params]) => params[0] === 'completed');
                expect(completedDeleteCall[1]).toEqual(['completed', 14, 5000]);
                const failedDeleteCall = getDeleteCalls().find(([, params]) => params[0] === 'failed');
                expect(failedDeleteCall[1]).toEqual(['failed', 45, 5000]);
                const cancelledDeleteCall = getDeleteCalls().find(([, params]) => params[0] === 'cancelled');
                expect(cancelledDeleteCall[1]).toEqual(['cancelled', 2, 5000]);
            } finally {
                if (previousCompleted === undefined) delete process.env.TASK_QUEUE_RETENTION_DAYS;
                else process.env.TASK_QUEUE_RETENTION_DAYS = previousCompleted;
                if (previousFailed === undefined) delete process.env.TASK_QUEUE_FAILED_RETENTION_DAYS;
                else process.env.TASK_QUEUE_FAILED_RETENTION_DAYS = previousFailed;
                if (previousCancelled === undefined) delete process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS;
                else process.env.TASK_QUEUE_CANCELLED_RETENTION_DAYS = previousCancelled;
            }
        });

        test('logs non-fatal vacuum failures without throwing', async () => {
            mockRetentionSettings({
                completed: '7',
                failed: '30',
                cancelled: '3',
            });
            mockTerminalCounts({
                completed: { stale: 10, total: 20 },
                failed: { stale: 0, total: 0 },
                cancelled: { stale: 0, total: 0 },
            });
            db.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 10 })
                .mockResolvedValueOnce({ rowCount: 0 });
            mockTerminalCounts({
                completed: { stale: 0, total: 10 },
                failed: { stale: 0, total: 0 },
                cancelled: { stale: 0, total: 0 },
            });
            mockCleanupHistoryInsert();
            db.query.mockRejectedValueOnce(new Error('vacuum not allowed in transaction'));

            await expect(service.runScheduledTaskQueueCleanup()).resolves.toBeUndefined();

            expect(logger.warn).toHaveBeenCalledWith(
                'task_queue VACUUM ANALYZE failed after scheduled cleanup (non-fatal)',
                expect.objectContaining({ error: 'vacuum not allowed in transaction' })
            );
        });
    });
});
