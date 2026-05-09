/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
    query: jest.fn(),
    withSessionAdvisoryLock: jest.fn(),
    DB_ADVISORY_LOCKS: {
        IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003,
        STARTUP_RESET: 1234567890,
        GAP_ANALYSIS: 2001, LIBRARY_SYNC: 2002, RETRY_QUEUE: 2003,
        ENRICHMENT_RETRY_QUEUE: 2004, RATING_NORMALIZATION_CHECK: 2005, STALE_CLEANUP: 2006
    }
};

const mockNodeCron = {
    schedule: jest.fn().mockReturnValue({ stop: jest.fn() })
};

const mockQueueService = {
    refillQueue: jest.fn(),
    setScheduler: jest.fn()
};

const mockQueueMaintenanceService = {
    runScheduledTaskQueueCleanup: jest.fn()
};

const mockMediaSync = {
    syncLibrary: jest.fn()
};

const mockDiscordBot = {};

const mockOllama = {};

const mockClassification = {
    retryClassification: jest.fn()
};

const mockLoggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

const mockLoggerModule = {
    createLogger: () => mockLoggerInstance
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.mock('node-cron', () => mockNodeCron);
jest.unstable_mockModule('node-cron', () => createMockModule(mockNodeCron));

jest.unstable_mockModule('../services/queueService.mjs', () => createNamedMockModule('queueService', mockQueueService));

jest.unstable_mockModule('../services/queueMaintenanceService.mjs', () => createNamedMockModule('queueMaintenanceService', mockQueueMaintenanceService));

jest.unstable_mockModule('../services/mediaSync.mjs', () => createNamedMockModule('mediaSyncService', mockMediaSync));

jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

jest.unstable_mockModule('../services/classification.mjs', () => createNamedMockModule('classificationService', mockClassification));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

describe('SchedulerService', () => {
    let scheduler;
    let logger;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

        jest.mock('node-cron', () => mockNodeCron);
        jest.unstable_mockModule('node-cron', () => createMockModule(mockNodeCron));

        jest.unstable_mockModule('../services/queueService.mjs', () => createNamedMockModule('queueService', mockQueueService));

        jest.unstable_mockModule('../services/queueMaintenanceService.mjs', () => createNamedMockModule('queueMaintenanceService', mockQueueMaintenanceService));

        jest.unstable_mockModule('../services/mediaSync.mjs', () => createNamedMockModule('mediaSyncService', mockMediaSync));

        jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

        jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

        jest.unstable_mockModule('../services/classification.mjs', () => createNamedMockModule('classificationService', mockClassification));

        const freshLoggerInstance = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };
        const freshLoggerModule = {
            createLogger: () => freshLoggerInstance
        };
        logger = freshLoggerInstance;

        jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(freshLoggerModule));

        ({ schedulerService: scheduler } = await import('../services/scheduler.mjs'));
    });

    describe('Security Cleanup Tasks', () => {
        it('runRefreshTokenCleanup deletes expired tokens', async () => {
            const dbModule = mockDb;
            dbModule.query.mockResolvedValue({ rowCount: 5 });

            await scheduler.runRefreshTokenCleanup();

            expect(dbModule.query).toHaveBeenCalledTimes(1);
            const [sql] = dbModule.query.mock.calls[0];
            expect(sql).toMatch(/DELETE FROM refresh_tokens/);
            expect(sql).toMatch(/expires_at < NOW\(\)/);
        });

        it('runRefreshTokenCleanup is skipped when REFRESH_TOKEN_CLEANUP_ENABLED=false', async () => {
            const dbModule = mockDb;
            const originalEnv = process.env.REFRESH_TOKEN_CLEANUP_ENABLED;
            process.env.REFRESH_TOKEN_CLEANUP_ENABLED = 'false';

            await scheduler.runRefreshTokenCleanup();

            expect(dbModule.query).not.toHaveBeenCalled();
            process.env.REFRESH_TOKEN_CLEANUP_ENABLED = originalEnv;
        });

        it('runApiKeyAuditPrune deletes rows older than retention window', async () => {
            const dbModule = mockDb;
            dbModule.query.mockResolvedValue({ rowCount: 12 });

            await scheduler.runApiKeyAuditPrune();

            expect(dbModule.query).toHaveBeenCalledTimes(1);
            const [sql] = dbModule.query.mock.calls[0];
            expect(sql).toMatch(/DELETE FROM api_key_audit/);
        });

        it('runApiKeyAuditPrune uses API_AUDIT_RETENTION_DAYS env var', async () => {
            const dbModule = mockDb;
            dbModule.query.mockResolvedValue({ rowCount: 3 });
            const originalEnv = process.env.API_AUDIT_RETENTION_DAYS;
            process.env.API_AUDIT_RETENTION_DAYS = '30';

            await scheduler.runApiKeyAuditPrune();

            const [, params] = dbModule.query.mock.calls[0];
            expect(params[0]).toBe(30);
            process.env.API_AUDIT_RETENTION_DAYS = originalEnv;
        });

        it('runRefreshTokenCleanup logs error and does not throw on DB failure', async () => {
            const dbModule = mockDb;
            dbModule.query.mockRejectedValue(new Error('DB connection failed'));

            await expect(scheduler.runRefreshTokenCleanup()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'Refresh token cleanup failed',
                expect.objectContaining({ error: 'DB connection failed' })
            );
        });

        it('runApiKeyAuditPrune logs error and does not throw on DB failure', async () => {
            const dbModule = mockDb;
            dbModule.query.mockRejectedValue(new Error('DB connection failed'));

            await expect(scheduler.runApiKeyAuditPrune()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'API key audit prune failed',
                expect.objectContaining({ error: 'DB connection failed' })
            );
        });

        it('runErrorLogCleanup uses settings.error_log_retention_days and deletes in batches', async () => {
            const dbModule = mockDb;
            dbModule.query
                // Settings lookup
                .mockResolvedValueOnce({ rows: [{ value: '14' }] })
                // Delete batch 1 (full batch)
                .mockResolvedValueOnce({ rowCount: 1000 })
                // Delete batch 2 (final batch)
                .mockResolvedValueOnce({ rowCount: 12 });

            await scheduler.runErrorLogCleanup();

            expect(dbModule.query).toHaveBeenCalledTimes(3);
            const [, deleteCallOneParams] = dbModule.query.mock.calls[1];
            expect(deleteCallOneParams).toEqual([14, 1000]);
            expect(logger.info).toHaveBeenCalledWith(
                'Error log cleanup complete',
                expect.objectContaining({ deleted: 1012, retentionDays: 14 })
            );
        });

        it('runErrorLogCleanup falls back to 30 days when setting is missing/invalid', async () => {
            const dbModule = mockDb;
            dbModule.query
                .mockResolvedValueOnce({ rows: [{ value: 'not-a-number' }] })
                .mockResolvedValueOnce({ rowCount: 0 });

            await scheduler.runErrorLogCleanup();

            const [, deleteParams] = dbModule.query.mock.calls[1];
            expect(deleteParams).toEqual([30, 1000]);
            expect(logger.debug).toHaveBeenCalledWith(
                'Error log cleanup: no rows to delete',
                expect.objectContaining({ retentionDays: 30 })
            );
        });

        it('runErrorLogCleanup logs error and does not throw on DB failure', async () => {
            const dbModule = mockDb;
            dbModule.query.mockRejectedValue(new Error('DB connection failed'));

            await expect(scheduler.runErrorLogCleanup()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'Error log cleanup failed',
                expect.objectContaining({ error: 'DB connection failed' })
            );
        });
    });

    describe('cleanupStaleAwaitingDecisions', () => {
        it('skips when no stale rows', async () => {
            const dbModule = mockDb;
            dbModule.query.mockResolvedValue({ rowCount: 0, rows: [] });

            await scheduler.cleanupStaleAwaitingDecisions();

            // Only the UPDATE should have been called, no INSERT to task_queue
            const insertCall = dbModule.query.mock.calls.find(
                ([sql]) => sql && sql.includes('INSERT INTO task_queue')
            );
            expect(insertCall).toBeUndefined();
        });

        it('resets stale rows and re-queues them in task_queue', async () => {
            const dbModule = mockDb;
            const staleRows = [
                { id: 1, title: 'Old Movie', tmdb_id: 100, media_type: 'movie' },
                { id: 2, title: 'Old Show', tmdb_id: 200, media_type: 'tv' }
            ];

            dbModule.query.mockImplementation((sql) => {
                if (sql && sql.includes('UPDATE classification_history')) {
                    return Promise.resolve({ rowCount: 2, rows: staleRows });
                }
                if (sql && sql.includes('INSERT INTO task_queue')) {
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            });

            await scheduler.cleanupStaleAwaitingDecisions();

            const insertCalls = dbModule.query.mock.calls.filter(
                ([sql]) => sql && sql.includes('INSERT INTO task_queue')
            );
            expect(insertCalls).toHaveLength(2);
        });

        it('handles queue insert failure gracefully without stopping other rows', async () => {
            const dbModule = mockDb;
            const staleRows = [
                { id: 1, title: 'Old Movie', tmdb_id: 100, media_type: 'movie' },
                { id: 2, title: 'Old Show', tmdb_id: 200, media_type: 'tv' }
            ];

            let insertCallCount = 0;
            dbModule.query.mockImplementation((sql) => {
                if (sql && sql.includes('UPDATE classification_history')) {
                    return Promise.resolve({ rowCount: 2, rows: staleRows });
                }
                if (sql && sql.includes('INSERT INTO task_queue')) {
                    insertCallCount++;
                    if (insertCallCount === 1) {
                        return Promise.reject(new Error('Queue insert failed'));
                    }
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            });

            // Should not throw even if first insert fails
            await expect(scheduler.cleanupStaleAwaitingDecisions()).resolves.toBeUndefined();

            // Both inserts should have been attempted
            expect(insertCallCount).toBe(2);
        });
    });

    describe('runGapAnalysis', () => {
        it('lazily resolves queueService and delegates to refillQueue', async () => {
            const queueService = mockQueueService;
            queueService.refillQueue.mockResolvedValueOnce({ queued: 3 });

            await expect(scheduler.runGapAnalysis()).resolves.toBeUndefined();

            expect(queueService.refillQueue).toHaveBeenCalledTimes(1);
        });

        it('logs the refill failure without throwing', async () => {
            const queueService = mockQueueService;
            queueService.refillQueue.mockRejectedValueOnce(new Error('refill failed'));

            await expect(scheduler.runGapAnalysis()).resolves.toBeUndefined();

            expect(logger.error).toHaveBeenCalledWith(
                'Error running gap analysis',
                expect.objectContaining({ error: 'refill failed' })
            );
        });
    });

    describe('runLibraryWatchdog', () => {
        it('issues a single query and triggers syncLibrary for empty libraries', async () => {
            const dbModule = mockDb;
            const mediaSyncModule = mockMediaSync;

            mediaSyncModule.syncLibrary.mockResolvedValue();
            dbModule.query.mockResolvedValue({
                rows: [
                    { id: 1, name: 'Movies' },
                    { id: 2, name: 'Kids' }
                ]
            });

            await scheduler.runLibraryWatchdog();

            // Only ONE query should be executed (the combined NOT EXISTS query)
            expect(dbModule.query).toHaveBeenCalledTimes(1);
            const [sql] = dbModule.query.mock.calls[0];
            expect(sql).toMatch(/NOT EXISTS/);
            expect(sql).toMatch(/media_server_items/);
            expect(sql).toMatch(/media_server_sync_status/);
            expect(sql).toMatch(/status = 'running'/);

            // syncLibrary called once per empty library
            expect(mediaSyncModule.syncLibrary).toHaveBeenCalledTimes(2);
            expect(mediaSyncModule.syncLibrary).toHaveBeenCalledWith(1);
            expect(mediaSyncModule.syncLibrary).toHaveBeenCalledWith(2);
        });

        it('does not call syncLibrary when no empty libraries are returned', async () => {
            const dbModule = mockDb;
            const mediaSyncModule = mockMediaSync;

            dbModule.query.mockResolvedValue({ rows: [] });

            await scheduler.runLibraryWatchdog();

            expect(dbModule.query).toHaveBeenCalledTimes(1);
            expect(mediaSyncModule.syncLibrary).not.toHaveBeenCalled();
        });

        it('logs error and does not throw on DB failure', async () => {
            const dbModule = mockDb;
            dbModule.query.mockRejectedValue(new Error('connection lost'));

            await expect(scheduler.runLibraryWatchdog()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'Error running library watchdog',
                expect.objectContaining({ error: 'connection lost' })
            );
        });
    });

    describe('runAutoLearnRules', () => {
        it('inserts all rules in a single UNNEST query per library', async () => {
            const dbModule = mockDb;
            let callIndex = 0;

            dbModule.query.mockImplementation((_sql) => {
                callIndex++;
                // First call: find libraries needing rule learning
                if (callIndex === 1) {
                    return Promise.resolve({
                        rows: [{ id: 10, name: 'Movies', media_type: 'movie', item_count: 100 }]
                    });
                }
                // Second call: analysis query (ratings, genres, languages)
                if (callIndex === 2) {
                    return Promise.resolve({
                        rows: [{
                            ratings: ['PG', 'PG-13'],
                            genres: ['Action', 'Drama'],
                            languages: null
                        }]
                    });
                }
                // Third call: keyword analysis
                if (callIndex === 3) {
                    return Promise.resolve({
                        rows: [{ christmas_count: '0', holiday_count: '0', hallmark_count: '0', total: '100' }]
                    });
                }
                // Fourth call: the bulk INSERT
                return Promise.resolve({ rowCount: 2, rows: [] });
            });

            await scheduler.runAutoLearnRules();

            // Should be exactly 4 queries: libraries scan + analysis + keyword analysis + 1 bulk INSERT
            expect(callIndex).toBe(4);

            const insertCall = dbModule.query.mock.calls[3];
            const [insertSql, insertParams] = insertCall;
            expect(insertSql).toMatch(/UNNEST/);
            expect(insertSql).toMatch(/ON CONFLICT DO NOTHING/);
            expect(insertSql).toMatch(/INSERT INTO library_rules/);

            // library_id param
            expect(insertParams[0]).toBe(10);
            // rule_type array should contain 'rating' and 'genre'
            const ruleTypes = insertParams[1];
            expect(ruleTypes).toContain('rating');
            expect(ruleTypes).toContain('genre');
            // Each array should be the same length
            expect(insertParams[1].length).toBe(insertParams[2].length);
            expect(insertParams[1].length).toBe(insertParams[3].length);
            expect(insertParams[1].length).toBe(insertParams[4].length);
        });

        it('skips INSERT when no rules match for a library', async () => {
            const dbModule = mockDb;
            let callIndex = 0;

            dbModule.query.mockImplementation(() => {
                callIndex++;
                if (callIndex === 1) {
                    return Promise.resolve({
                        rows: [{ id: 20, name: 'Random', media_type: 'movie', item_count: 50 }]
                    });
                }
                if (callIndex === 2) {
                    // no ratings, no genres, no languages
                    return Promise.resolve({ rows: [{ ratings: null, genres: null, languages: null }] });
                }
                if (callIndex === 3) {
                    return Promise.resolve({
                        rows: [{ christmas_count: '0', holiday_count: '0', hallmark_count: '0', total: '50' }]
                    });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            });

            await scheduler.runAutoLearnRules();

            // Only 3 queries (libraries + analysis + keyword), no INSERT
            expect(callIndex).toBe(3);
        });

        it('does nothing when no libraries need rule learning', async () => {
            const dbModule = mockDb;
            dbModule.query.mockResolvedValue({ rows: [] });

            await scheduler.runAutoLearnRules();

            expect(dbModule.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('runRatingNormalizationCheck', () => {
        it('uses partial conflict target to skip only pending/processing items', async () => {
            const dbModule = mockDb;
            scheduler.ratingNormalizer = {
                getNeedsNormalizationSQL: jest.fn().mockReturnValue('content_rating IS NOT NULL')
            };
            // First call: COUNT query
            dbModule.query
                .mockResolvedValueOnce({ rows: [{ count: '3' }] })
                // Second call: INSERT
                .mockResolvedValueOnce({ rowCount: 2 });

            await scheduler.runRatingNormalizationCheck();

            const insertCall = dbModule.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO task_queue')
            );
            expect(insertCall).toBeDefined();
            const [insertSql] = insertCall;
            // Must reference the conflict index columns and partial predicate
            expect(insertSql).toMatch(/ON CONFLICT.*media_item_id/s);
            expect(insertSql).toMatch(/pending.*processing/s);
            // Must NOT use the bare DO NOTHING without a conflict target
            expect(insertSql).not.toMatch(/^\s*ON CONFLICT DO NOTHING/m);
        });

        it('does not INSERT when count is zero', async () => {
            const dbModule = mockDb;
            scheduler.ratingNormalizer = {
                getNeedsNormalizationSQL: jest.fn().mockReturnValue('content_rating IS NOT NULL')
            };
            dbModule.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await scheduler.runRatingNormalizationCheck();

            const insertCall = dbModule.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO task_queue')
            );
            expect(insertCall).toBeUndefined();
        });
    });

    describe('schedule() advisory lock integration', () => {
        it('skips handler and logs debug when advisory lock is held by another process', async () => {
            const dbModule = mockDb;
            const cron = mockNodeCron;

            // Simulate lock held by another process
            dbModule.withSessionAdvisoryLock.mockResolvedValue(false);

            const handler = jest.fn();
            scheduler.schedule('lock-test', '*/5 * * * *', handler, 9999);

            // Invoke the cron handler registered by schedule()
            const cronHandler = cron.schedule.mock.calls.at(-1)[1];
            await cronHandler();

            expect(handler).not.toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('lock-test'),
                expect.objectContaining({ lockKey: 9999 })
            );
        });

        it('calls handler and logs completion when lock is acquired', async () => {
            const dbModule = mockDb;
            const cron = mockNodeCron;

            const handler = jest.fn().mockResolvedValue();
            // Simulate lock acquired: withSessionAdvisoryLock calls fn() and returns true
            dbModule.withSessionAdvisoryLock.mockImplementation(async (_key, fn) => {
                await fn();
                return true;
            });

            scheduler.schedule('lock-test-2', '*/5 * * * *', handler, 9999);

            const cronHandler = cron.schedule.mock.calls.at(-1)[1];
            await cronHandler();

            expect(handler).toHaveBeenCalledTimes(1);
            expect(logger.info).toHaveBeenCalledWith('Completed scheduled task: lock-test-2');
        });

        it('calls handler directly (no advisory lock) when lockKey is omitted', async () => {
            const dbModule = mockDb;
            const cron = mockNodeCron;

            const handler = jest.fn().mockResolvedValue();            scheduler.schedule('no-lock-test', '*/5 * * * *', handler); // no lockKey

            const cronHandler = cron.schedule.mock.calls.at(-1)[1];
            await cronHandler();

            expect(handler).toHaveBeenCalledTimes(1);
            expect(dbModule.withSessionAdvisoryLock).not.toHaveBeenCalled();
        });
    });

    describe('runTaskQueueCleanup', () => {
        it('delegates scheduled task_queue cleanup to QueueMaintenanceService', async () => {
            mockQueueMaintenanceService.runScheduledTaskQueueCleanup.mockResolvedValueOnce(undefined);

            await expect(scheduler.runTaskQueueCleanup()).resolves.toBeUndefined();

            expect(mockQueueMaintenanceService.runScheduledTaskQueueCleanup).toHaveBeenCalledTimes(1);
        });
    });
});
