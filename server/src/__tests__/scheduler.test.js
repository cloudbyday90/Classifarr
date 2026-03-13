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

jest.mock('../config/database', () => ({
    query: jest.fn(),
    withSessionAdvisoryLock: jest.fn(),
    DB_ADVISORY_LOCKS: {
        IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003,
        STARTUP_RESET: 1234567890,
        GAP_ANALYSIS: 2001, LIBRARY_SYNC: 2002, RETRY_QUEUE: 2003,
        ENRICHMENT_RETRY_QUEUE: 2004, RATING_NORMALIZATION_CHECK: 2005, STALE_CLEANUP: 2006
    }
}));

jest.mock('node-cron', () => ({
    schedule: jest.fn().mockReturnValue({ stop: jest.fn() })
}));

jest.mock('../services/queueService', () => ({
    refillQueue: jest.fn()
}));

jest.mock('../services/mediaSync', () => ({
    syncLibrary: jest.fn()
}));

jest.mock('../services/discordBot', () => ({}));

jest.mock('../services/ollama', () => ({}));

jest.mock('../services/classification', () => ({
    retryClassification: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

describe('SchedulerService', () => {
    let scheduler;
    let logger;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Re-mock after resetModules
        jest.mock('../config/database', () => ({
            query: jest.fn(),
            withSessionAdvisoryLock: jest.fn(),
            DB_ADVISORY_LOCKS: {
                IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003,
                STARTUP_RESET: 1234567890,
                GAP_ANALYSIS: 2001, LIBRARY_SYNC: 2002, RETRY_QUEUE: 2003,
                ENRICHMENT_RETRY_QUEUE: 2004, RATING_NORMALIZATION_CHECK: 2005, STALE_CLEANUP: 2006
            }
        }));
        jest.mock('node-cron', () => ({
            schedule: jest.fn().mockReturnValue({ stop: jest.fn() })
        }));
        jest.mock('../services/queueService', () => ({ refillQueue: jest.fn() }));
        jest.mock('../services/mediaSync', () => ({ syncLibrary: jest.fn() }));
        jest.mock('../services/discordBot', () => ({}));
        jest.mock('../services/ollama', () => ({}));
        jest.mock('../services/classification', () => ({ retryClassification: jest.fn() }));

        const mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };
        jest.mock('../utils/logger', () => ({
            createLogger: () => mockLogger
        }));
        logger = mockLogger;

        // Require fresh instance
        const SchedulerModule = require('../services/scheduler');
        scheduler = SchedulerModule;
    });

    describe('Security Cleanup Tasks', () => {
        it('runRefreshTokenCleanup deletes expired tokens', async () => {
            const dbModule = require('../config/database');
            dbModule.query.mockResolvedValue({ rowCount: 5 });

            await scheduler.runRefreshTokenCleanup();

            expect(dbModule.query).toHaveBeenCalledTimes(1);
            const [sql] = dbModule.query.mock.calls[0];
            expect(sql).toMatch(/DELETE FROM refresh_tokens/);
            expect(sql).toMatch(/expires_at < NOW\(\)/);
        });

        it('runRefreshTokenCleanup is skipped when REFRESH_TOKEN_CLEANUP_ENABLED=false', async () => {
            const dbModule = require('../config/database');
            const originalEnv = process.env.REFRESH_TOKEN_CLEANUP_ENABLED;
            process.env.REFRESH_TOKEN_CLEANUP_ENABLED = 'false';

            await scheduler.runRefreshTokenCleanup();

            expect(dbModule.query).not.toHaveBeenCalled();
            process.env.REFRESH_TOKEN_CLEANUP_ENABLED = originalEnv;
        });

        it('runApiKeyAuditPrune deletes rows older than retention window', async () => {
            const dbModule = require('../config/database');
            dbModule.query.mockResolvedValue({ rowCount: 12 });

            await scheduler.runApiKeyAuditPrune();

            expect(dbModule.query).toHaveBeenCalledTimes(1);
            const [sql] = dbModule.query.mock.calls[0];
            expect(sql).toMatch(/DELETE FROM api_key_audit/);
        });

        it('runApiKeyAuditPrune uses API_AUDIT_RETENTION_DAYS env var', async () => {
            const dbModule = require('../config/database');
            dbModule.query.mockResolvedValue({ rowCount: 3 });
            const originalEnv = process.env.API_AUDIT_RETENTION_DAYS;
            process.env.API_AUDIT_RETENTION_DAYS = '30';

            await scheduler.runApiKeyAuditPrune();

            const [, params] = dbModule.query.mock.calls[0];
            expect(params[0]).toBe(30);
            process.env.API_AUDIT_RETENTION_DAYS = originalEnv;
        });

        it('runRefreshTokenCleanup logs error and does not throw on DB failure', async () => {
            const dbModule = require('../config/database');
            dbModule.query.mockRejectedValue(new Error('DB connection failed'));

            await expect(scheduler.runRefreshTokenCleanup()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'Refresh token cleanup failed',
                expect.objectContaining({ error: 'DB connection failed' })
            );
        });

        it('runApiKeyAuditPrune logs error and does not throw on DB failure', async () => {
            const dbModule = require('../config/database');
            dbModule.query.mockRejectedValue(new Error('DB connection failed'));

            await expect(scheduler.runApiKeyAuditPrune()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'API key audit prune failed',
                expect.objectContaining({ error: 'DB connection failed' })
            );
        });
    });

    describe('cleanupStaleAwaitingDecisions', () => {
        it('skips when no stale rows', async () => {
            const dbModule = require('../config/database');
            dbModule.query.mockResolvedValue({ rowCount: 0, rows: [] });

            await scheduler.cleanupStaleAwaitingDecisions();

            // Only the UPDATE should have been called, no INSERT to task_queue
            const insertCall = dbModule.query.mock.calls.find(
                ([sql]) => sql && sql.includes('INSERT INTO task_queue')
            );
            expect(insertCall).toBeUndefined();
        });

        it('resets stale rows and re-queues them in task_queue', async () => {
            const dbModule = require('../config/database');
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
            const dbModule = require('../config/database');
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

    describe('runLibraryWatchdog', () => {
        it('issues a single query and triggers syncLibrary for empty libraries', async () => {
            const dbModule = require('../config/database');
            const mediaSyncModule = require('../services/mediaSync');

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
            const dbModule = require('../config/database');
            const mediaSyncModule = require('../services/mediaSync');

            dbModule.query.mockResolvedValue({ rows: [] });

            await scheduler.runLibraryWatchdog();

            expect(dbModule.query).toHaveBeenCalledTimes(1);
            expect(mediaSyncModule.syncLibrary).not.toHaveBeenCalled();
        });

        it('logs error and does not throw on DB failure', async () => {
            const dbModule = require('../config/database');
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
            const dbModule = require('../config/database');
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
            const dbModule = require('../config/database');
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
            const dbModule = require('../config/database');
            dbModule.query.mockResolvedValue({ rows: [] });

            await scheduler.runAutoLearnRules();

            expect(dbModule.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('runRatingNormalizationCheck', () => {
        it('uses partial conflict target to skip only pending/processing items', async () => {
            // Lazy-require ratingNormalizer mock before re-requiring scheduler
            jest.mock('../utils/ratingNormalizer', () => ({
                getNeedsNormalizationSQL: jest.fn().mockReturnValue("content_rating IS NOT NULL")
            }));
            const dbModule = require('../config/database');
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
            jest.mock('../utils/ratingNormalizer', () => ({
                getNeedsNormalizationSQL: jest.fn().mockReturnValue("content_rating IS NOT NULL")
            }));
            const dbModule = require('../config/database');
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
            const dbModule = require('../config/database');
            const cron = require('node-cron');

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
            const dbModule = require('../config/database');
            const cron = require('node-cron');

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
            const dbModule = require('../config/database');
            const cron = require('node-cron');

            const handler = jest.fn().mockResolvedValue();            scheduler.schedule('no-lock-test', '*/5 * * * *', handler); // no lockKey

            const cronHandler = cron.schedule.mock.calls.at(-1)[1];
            await cronHandler();

            expect(handler).toHaveBeenCalledTimes(1);
            expect(dbModule.withSessionAdvisoryLock).not.toHaveBeenCalled();
        });
    });

    describe('runTaskQueueCleanup', () => {
        it('no-op when table is healthy (under retention and under row cap)', async () => {
            const dbModule = require('../config/database');
            // Age DELETE: 0 rows deleted → exits do-while
            dbModule.query
                .mockResolvedValueOnce({ rowCount: 0 })
                // COUNT: 1000 rows remaining, well under 50k cap
                .mockResolvedValueOnce({ rows: [{ n: '1000' }] });

            await scheduler.runTaskQueueCleanup();

            // VACUUM should NOT have been called (totalDeleted === 0)
            const vacuumCall = dbModule.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes('VACUUM')
            );
            expect(vacuumCall).toBeUndefined();
            expect(logger.debug).toHaveBeenCalledWith(
                'Task queue cleanup: no rows to delete',
                expect.objectContaining({ retentionDays: expect.any(Number) })
            );
        });

        it('age-based drain: deletes stale rows and runs VACUUM ANALYZE', async () => {
            const dbModule = require('../config/database');
            // Age DELETE: 3 rows (< BATCH=5000) → exits do-while after one pass
            dbModule.query
                .mockResolvedValueOnce({ rowCount: 3 })
                // COUNT: remaining well under cap
                .mockResolvedValueOnce({ rows: [{ n: '500' }] })
                // VACUUM ANALYZE
                .mockResolvedValueOnce({});

            await scheduler.runTaskQueueCleanup();

            const ageDel = dbModule.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM task_queue') && !sql.includes('ORDER BY')
            );
            expect(ageDel).toBeDefined();

            const vacuumCall = dbModule.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes('VACUUM ANALYZE task_queue')
            );
            expect(vacuumCall).toBeDefined();

            expect(logger.info).toHaveBeenCalledWith(
                'Task queue cleanup complete',
                expect.objectContaining({ deleted: 3 })
            );
        });

        it('count-based cap: trims oldest rows when total exceeds MAX_TOTAL_ROWS', async () => {
            const dbModule = require('../config/database');
            const excess = 5000;
            // Age DELETE: 0 stale rows
            dbModule.query
                .mockResolvedValueOnce({ rowCount: 0 })
                // COUNT: 55 000 rows (over 50 000 default cap)
                .mockResolvedValueOnce({ rows: [{ n: '55000' }] })
                // Count-based DELETE: removes exactly `excess` rows → loop exits
                .mockResolvedValueOnce({ rowCount: excess })
                // VACUUM ANALYZE
                .mockResolvedValueOnce({});

            await scheduler.runTaskQueueCleanup();

            expect(logger.warn).toHaveBeenCalledWith(
                'task_queue count cap exceeded during scheduled cleanup; trimming oldest rows',
                expect.objectContaining({ remaining: 55000, toDelete: excess })
            );

            const countDel = dbModule.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' &&
                    sql.includes('DELETE FROM task_queue') &&
                    sql.includes('ORDER BY created_at ASC')
            );
            expect(countDel).toBeDefined();

            const vacuumCall = dbModule.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes('VACUUM ANALYZE task_queue')
            );
            expect(vacuumCall).toBeDefined();
        });

        it('combined: age pass + count cap both delete rows, single VACUUM at the end', async () => {
            const dbModule = require('../config/database');
            // Age DELETE: 500 stale rows → exits (< BATCH)
            dbModule.query
                .mockResolvedValueOnce({ rowCount: 500 })
                // COUNT: still 55 000 over cap after age pass
                .mockResolvedValueOnce({ rows: [{ n: '55000' }] })
                // Count-based DELETE: removes 5000
                .mockResolvedValueOnce({ rowCount: 5000 })
                // VACUUM ANALYZE
                .mockResolvedValueOnce({});

            await scheduler.runTaskQueueCleanup();

            expect(logger.info).toHaveBeenCalledWith(
                'Task queue cleanup complete',
                expect.objectContaining({ deleted: 5500 })
            );
            expect(logger.warn).toHaveBeenCalledWith(
                'task_queue count cap exceeded during scheduled cleanup; trimming oldest rows',
                expect.any(Object)
            );

            const vacuumCalls = dbModule.query.mock.calls.filter(
                ([sql]) => typeof sql === 'string' && sql.includes('VACUUM ANALYZE task_queue')
            );
            expect(vacuumCalls).toHaveLength(1);
        });

        it('non-fatal VACUUM failure logs warn and does not throw', async () => {
            const dbModule = require('../config/database');
            // Age DELETE: 10 rows deleted
            dbModule.query
                .mockResolvedValueOnce({ rowCount: 10 })
                // COUNT: under cap
                .mockResolvedValueOnce({ rows: [{ n: '100' }] })
                // VACUUM ANALYZE fails
                .mockRejectedValueOnce(new Error('vacuum not allowed in transaction'));

            await expect(scheduler.runTaskQueueCleanup()).resolves.toBeUndefined();

            expect(logger.warn).toHaveBeenCalledWith(
                'task_queue VACUUM ANALYZE failed after scheduled cleanup (non-fatal)',
                expect.objectContaining({ error: 'vacuum not allowed in transaction' })
            );
        });
    });
});
