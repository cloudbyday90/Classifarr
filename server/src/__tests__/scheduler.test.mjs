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
        ENRICHMENT_RETRY_QUEUE: 2004, RATING_NORMALIZATION_CHECK: 2005, STALE_CLEANUP: 2006,
        POLICY_ROLLBACK_SNAPSHOT_RETENTION: 2007, NATIVE_INTENT_RECONCILIATION: 2008,
        NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION: 2009,
        POLICY_PROFILE_REFRESH_OUTBOX: 2011,
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

const mockSchedulerRetentionService = {
    runRefreshTokenCleanup: jest.fn(),
    runApiKeyAuditPrune: jest.fn(),
    runErrorLogCleanup: jest.fn(),
    runWebSearchProviderRetentionCleanup: jest.fn(),
    runPolicyRollbackSnapshotRetentionCleanup: jest.fn(),
    runPolicyObservedEvidenceProvenanceRetentionCleanup: jest.fn(),
    runNativeIntentReconciliationLedgerRetentionCleanup: jest.fn(),
    runPolicyNativeIntentChangeReceiptRetentionCleanup: jest.fn(),
    runPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionCleanup: jest.fn(),
    runPolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionCleanup: jest.fn(),
};

const mockClassificationMaintenanceService = {
    cleanupStaleAwaitingDecisions: jest.fn()
};

const mockRatingNormalizationQueueService = {
    queueDailyBackfill: jest.fn()
};

const mockNativeIntentReconciliationService = {
    run: jest.fn(),
};

const mockPolicyProfileRefreshAutomationService = {
    run: jest.fn(),
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

jest.unstable_mockModule('node-cron', () => createMockModule(mockNodeCron));

jest.unstable_mockModule('../services/queueService.mjs', () => createNamedMockModule('queueService', mockQueueService));

jest.unstable_mockModule('../services/queueMaintenanceService.mjs', () => createNamedMockModule('queueMaintenanceService', mockQueueMaintenanceService));

jest.unstable_mockModule('../services/schedulerRetentionService.mjs', () => createNamedMockModule('schedulerRetentionService', mockSchedulerRetentionService));

jest.unstable_mockModule('../services/classificationMaintenanceService.mjs', () => createNamedMockModule('classificationMaintenanceService', mockClassificationMaintenanceService));

jest.unstable_mockModule('../services/ratingNormalizationQueueService.mjs', () => createNamedMockModule('ratingNormalizationQueueService', mockRatingNormalizationQueueService));

jest.unstable_mockModule('../services/nativeIntentReconciliationService.mjs', () => createNamedMockModule('nativeIntentReconciliationService', mockNativeIntentReconciliationService));

jest.unstable_mockModule('../services/policyProfileRefreshAutomationService.mjs', () => createNamedMockModule('policyProfileRefreshAutomationService', mockPolicyProfileRefreshAutomationService));

jest.unstable_mockModule('../services/mediaSync.mjs', () => createNamedMockModule('mediaSyncService', mockMediaSync));

jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

jest.unstable_mockModule('../services/classification.mjs', () => createNamedMockModule('classificationService', mockClassification));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

const { schedulerService: scheduler } = await import('../services/scheduler.mjs');

describe('SchedulerService', () => {
    const logger = mockLoggerInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDb.query.mockReset();
        mockDb.withSessionAdvisoryLock.mockReset();
        mockNodeCron.schedule.mockReset();
        mockNodeCron.schedule.mockReturnValue({ stop: jest.fn() });
        mockQueueService.refillQueue.mockReset();
        mockQueueService.setScheduler.mockReset();
        mockQueueMaintenanceService.runScheduledTaskQueueCleanup.mockReset();
        mockSchedulerRetentionService.runRefreshTokenCleanup.mockReset();
        mockSchedulerRetentionService.runApiKeyAuditPrune.mockReset();
        mockSchedulerRetentionService.runErrorLogCleanup.mockReset();
        mockSchedulerRetentionService.runWebSearchProviderRetentionCleanup.mockReset();
        mockSchedulerRetentionService.runPolicyRollbackSnapshotRetentionCleanup.mockReset();
        mockSchedulerRetentionService.runPolicyObservedEvidenceProvenanceRetentionCleanup.mockReset();
        mockSchedulerRetentionService.runNativeIntentReconciliationLedgerRetentionCleanup.mockReset();
        mockSchedulerRetentionService.runPolicyNativeIntentChangeReceiptRetentionCleanup.mockReset();
        mockSchedulerRetentionService.runPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionCleanup.mockReset();
        mockSchedulerRetentionService.runPolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionCleanup.mockReset();
        mockClassificationMaintenanceService.cleanupStaleAwaitingDecisions.mockReset();
        mockRatingNormalizationQueueService.queueDailyBackfill.mockReset();
        mockNativeIntentReconciliationService.run.mockReset();
        mockPolicyProfileRefreshAutomationService.run.mockReset();
        mockMediaSync.syncLibrary.mockReset();
        mockClassification.retryClassification.mockReset();
        logger.info.mockReset();
        logger.warn.mockReset();
        logger.error.mockReset();
        logger.debug.mockReset();
        scheduler.resetState();
    });

    describe('Security Cleanup Tasks', () => {
        it('runRefreshTokenCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runRefreshTokenCleanup.mockResolvedValueOnce(undefined);

            await expect(scheduler.runRefreshTokenCleanup()).resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runRefreshTokenCleanup).toHaveBeenCalledTimes(1);
        });

        it('runApiKeyAuditPrune delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runApiKeyAuditPrune.mockResolvedValueOnce(undefined);

            await expect(scheduler.runApiKeyAuditPrune()).resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runApiKeyAuditPrune).toHaveBeenCalledTimes(1);
        });

        it('runErrorLogCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runErrorLogCleanup.mockResolvedValueOnce(undefined);

            await expect(scheduler.runErrorLogCleanup()).resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runErrorLogCleanup).toHaveBeenCalledTimes(1);
        });

        it('runWebSearchProviderRetentionCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runWebSearchProviderRetentionCleanup.mockResolvedValueOnce(undefined);

            await expect(scheduler.runWebSearchProviderRetentionCleanup()).resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runWebSearchProviderRetentionCleanup).toHaveBeenCalledTimes(1);
        });

        it('runPolicyRollbackSnapshotRetentionCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runPolicyRollbackSnapshotRetentionCleanup.mockResolvedValueOnce(undefined);

            await expect(scheduler.runPolicyRollbackSnapshotRetentionCleanup()).resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runPolicyRollbackSnapshotRetentionCleanup).toHaveBeenCalledTimes(1);
        });

        it('runPolicyObservedEvidenceProvenanceRetentionCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runPolicyObservedEvidenceProvenanceRetentionCleanup
                .mockResolvedValueOnce(undefined);

            await expect(scheduler.runPolicyObservedEvidenceProvenanceRetentionCleanup())
                .resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runPolicyObservedEvidenceProvenanceRetentionCleanup)
                .toHaveBeenCalledTimes(1);
        });

        it('runNativeIntentReconciliationLedgerRetentionCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runNativeIntentReconciliationLedgerRetentionCleanup.mockResolvedValueOnce(undefined);

            await expect(scheduler.runNativeIntentReconciliationLedgerRetentionCleanup()).resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runNativeIntentReconciliationLedgerRetentionCleanup)
                .toHaveBeenCalledTimes(1);
        });

        it('runPolicyNativeIntentChangeReceiptRetentionCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runPolicyNativeIntentChangeReceiptRetentionCleanup
                .mockResolvedValueOnce(undefined);

            await expect(scheduler.runPolicyNativeIntentChangeReceiptRetentionCleanup())
                .resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runPolicyNativeIntentChangeReceiptRetentionCleanup)
                .toHaveBeenCalledTimes(1);
        });

        it('runPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionCleanup
                .mockResolvedValueOnce(undefined);

            await expect(scheduler.runPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionCleanup())
                .resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionCleanup)
                .toHaveBeenCalledTimes(1);
        });

        it('runPolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionCleanup delegates to SchedulerRetentionService', async () => {
            mockSchedulerRetentionService.runPolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionCleanup
                .mockResolvedValueOnce(undefined);

            await expect(scheduler.runPolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionCleanup())
                .resolves.toBeUndefined();

            expect(mockSchedulerRetentionService.runPolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionCleanup)
                .toHaveBeenCalledTimes(1);
        });
    });

    describe('cleanupStaleAwaitingDecisions', () => {
        it('delegates stale awaiting-decision cleanup to ClassificationMaintenanceService', async () => {
            mockClassificationMaintenanceService.cleanupStaleAwaitingDecisions.mockResolvedValueOnce(undefined);

            await expect(scheduler.cleanupStaleAwaitingDecisions()).resolves.toBeUndefined();

            expect(mockClassificationMaintenanceService.cleanupStaleAwaitingDecisions).toHaveBeenCalledTimes(1);
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

    describe('processRetryQueue', () => {
        it('dead-letters exhausted retries before selecting eligible items', async () => {
            // 1st query: dead-letter UPDATE ... RETURNING exhausted rows
            mockDb.query.mockResolvedValueOnce({
                rows: [{ id: 5, title: 'Deep Water', retry_count: 3, max_retries: 3 }],
            });
            // 2nd query: eligible SELECT (none ready)
            mockDb.query.mockResolvedValueOnce({ rows: [] });

            await scheduler.processRetryQueue();

            const firstQuery = mockDb.query.mock.calls[0][0];
            expect(firstQuery).toContain("status = 'failed'");
            expect(firstQuery).toContain('retry_count >= max_retries');
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Dead-lettered 1 exhausted classifications'),
                expect.objectContaining({ reasonCode: 'retry_exhausted', ids: [5] })
            );
            expect(mockClassification.retryClassification).not.toHaveBeenCalled();
        });

        it('processes eligible items after the dead-letter sweep finds nothing', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] }); // dead-letter UPDATE (none)
            mockDb.query.mockResolvedValueOnce({ rows: [{ id: 7, title: 'Pressure' }] }); // eligible SELECT
            mockClassification.retryClassification.mockResolvedValueOnce({ queued: true });

            await scheduler.processRetryQueue();

            expect(mockClassification.retryClassification).toHaveBeenCalledWith(7);
        });

        it('does not throw when the dead-letter sweep query fails', async () => {
            mockDb.query.mockRejectedValueOnce(new Error('db down')); // dead-letter UPDATE fails
            mockDb.query.mockResolvedValueOnce({ rows: [] }); // eligible SELECT

            await expect(scheduler.processRetryQueue()).resolves.toBeUndefined();

            expect(logger.error).toHaveBeenCalledWith(
                'Error dead-lettering exhausted classification retries',
                expect.objectContaining({ error: 'db down' })
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
        it('delegates daily rating normalization queuing to RatingNormalizationQueueService', async () => {
            mockRatingNormalizationQueueService.queueDailyBackfill.mockResolvedValueOnce({
                queued: 2,
                totalNeedingNormalization: 3,
            });

            await expect(scheduler.runRatingNormalizationCheck()).resolves.toEqual({
                queued: 2,
                totalNeedingNormalization: 3,
            });

            expect(mockRatingNormalizationQueueService.queueDailyBackfill).toHaveBeenCalledTimes(1);
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

    describe('native intent reconciliation scheduling', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        it('registers one lock-protected recurring task and one non-blocking initial run', async () => {
            jest.useFakeTimers();
            mockDb.withSessionAdvisoryLock.mockImplementation(async (_key, handler) => {
                await handler();
                return true;
            });
            mockNativeIntentReconciliationService.run.mockResolvedValue({ statusId: 'applied' });

            expect(scheduler.startNativeIntentReconciliation()).toBe(true);
            expect(scheduler.startNativeIntentReconciliation()).toBe(false);
            expect(mockNodeCron.schedule).toHaveBeenCalledWith(
                '*/10 * * * *',
                expect.any(Function),
                { noOverlap: true },
            );

            const cronHandler = mockNodeCron.schedule.mock.calls.at(-1)[1];
            await cronHandler();
            await jest.advanceTimersByTimeAsync(90_000);

            expect(mockDb.withSessionAdvisoryLock).toHaveBeenCalledWith(
                2008,
                expect.any(Function),
            );
            expect(mockNativeIntentReconciliationService.run).toHaveBeenCalledTimes(2);
        });

        it('runs reconciliation only once when the recurring and delayed-start invocations contend for its lock', async () => {
            jest.useFakeTimers();
            let releaseFirstRun;
            let lockHeld = false;
            const firstRun = new Promise(resolve => {
                releaseFirstRun = resolve;
            });
            mockDb.withSessionAdvisoryLock.mockImplementation(async (_key, handler) => {
                if (lockHeld) return false;

                lockHeld = true;
                try {
                    await handler();
                    return true;
                } finally {
                    lockHeld = false;
                }
            });
            mockNativeIntentReconciliationService.run.mockReturnValue(firstRun);

            scheduler.startNativeIntentReconciliation();
            const cronHandler = mockNodeCron.schedule.mock.calls.at(-1)[1];
            const recurringRun = cronHandler();
            await Promise.resolve();
            await Promise.resolve();

            expect(mockNativeIntentReconciliationService.run).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(90_000);

            expect(mockDb.withSessionAdvisoryLock).toHaveBeenCalledTimes(2);
            expect(mockDb.withSessionAdvisoryLock).toHaveBeenNthCalledWith(
                1,
                2008,
                expect.any(Function),
            );
            expect(mockDb.withSessionAdvisoryLock).toHaveBeenNthCalledWith(
                2,
                2008,
                expect.any(Function),
            );
            expect(mockNativeIntentReconciliationService.run).toHaveBeenCalledTimes(1);
            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('native-intent-reconciliation'),
                expect.objectContaining({ lockKey: 2008 }),
            );

            releaseFirstRun();
            await recurringRun;
        });

        it('schedules one fresh lock-protected initial run after scheduler reinitialization', async () => {
            jest.useFakeTimers();
            mockDb.withSessionAdvisoryLock.mockImplementation(async (_key, handler) => {
                await handler();
                return true;
            });
            mockNativeIntentReconciliationService.run.mockResolvedValue({ statusId: 'evaluated' });

            expect(scheduler.startNativeIntentReconciliation()).toBe(true);
            scheduler.resetState();
            expect(scheduler.startNativeIntentReconciliation()).toBe(true);

            await jest.advanceTimersByTimeAsync(90_000);

            expect(mockNodeCron.schedule).toHaveBeenCalledTimes(2);
            expect(mockDb.withSessionAdvisoryLock).toHaveBeenCalledTimes(1);
            expect(mockDb.withSessionAdvisoryLock).toHaveBeenCalledWith(
                2008,
                expect.any(Function),
            );
            expect(mockNativeIntentReconciliationService.run).toHaveBeenCalledTimes(1);
        });

        it('cancels a pending initial reconciliation run during scheduler reset', async () => {
            jest.useFakeTimers();
            mockDb.withSessionAdvisoryLock.mockImplementation(async (_key, handler) => {
                await handler();
                return true;
            });

            scheduler.startNativeIntentReconciliation();
            scheduler.resetState();
            await jest.advanceTimersByTimeAsync(90_000);

            expect(mockNativeIntentReconciliationService.run).not.toHaveBeenCalled();
        });
    });

    describe('policy profile refresh outbox scheduling', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        it('runs one lock-protected periodic worker and one delayed startup worker', async () => {
            jest.useFakeTimers();
            mockDb.withSessionAdvisoryLock.mockImplementation(async (_key, handler) => {
                await handler();
                return true;
            });
            mockPolicyProfileRefreshAutomationService.run.mockResolvedValue({
                planning: { statusId: 'completed' },
                delivery: { claimed: 1 },
            });

            expect(scheduler.startPolicyProfileRefreshOutboxWorker()).toBe(true);
            expect(scheduler.startPolicyProfileRefreshOutboxWorker()).toBe(false);
            expect(mockNodeCron.schedule).toHaveBeenCalledWith(
                '* * * * *',
                expect.any(Function),
                { noOverlap: true },
            );

            const cronHandler = mockNodeCron.schedule.mock.calls.at(-1)[1];
            await cronHandler();
            await jest.advanceTimersByTimeAsync(90_000);

            expect(mockDb.withSessionAdvisoryLock).toHaveBeenCalledWith(
                2011,
                expect.any(Function),
            );
            expect(mockPolicyProfileRefreshAutomationService.run).toHaveBeenCalledTimes(2);
        });
    });

    describe('runTaskQueueCleanup', () => {
        it('delegates scheduled task_queue cleanup to QueueMaintenanceService', async () => {
            mockQueueMaintenanceService.runScheduledTaskQueueCleanup.mockResolvedValueOnce(undefined);

            await expect(scheduler.runTaskQueueCleanup()).resolves.toBeUndefined();

            expect(mockQueueMaintenanceService.runScheduledTaskQueueCleanup).toHaveBeenCalledWith({
                cleanupOrigin: 'cron',
            });
        });

        it('forwards delayed-startup cleanup provenance to QueueMaintenanceService', async () => {
            mockQueueMaintenanceService.runScheduledTaskQueueCleanup.mockResolvedValueOnce(undefined);

            await expect(
                scheduler.runTaskQueueCleanup({ cleanupOrigin: 'startup_delayed' })
            ).resolves.toBeUndefined();

            expect(mockQueueMaintenanceService.runScheduledTaskQueueCleanup).toHaveBeenCalledWith({
                cleanupOrigin: 'startup_delayed',
            });
        });
    });
});
