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
    query: jest.fn()
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

const db = require('../config/database');

describe('SchedulerService', () => {
    let scheduler;
    let logger;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Re-mock after resetModules
        jest.mock('../config/database', () => ({
            query: jest.fn()
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
});
