/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { jest, describe, expect, test } from '@jest/globals';
import { createSchedulerCronOptions } from '../services/schedulerCronOptions.mjs';
import {
    buildSchedulerExecutionReceipt,
    elapsedSchedulerMilliseconds,
    SCHEDULER_EXECUTION_OUTCOME_IDS,
    SCHEDULER_EXECUTION_RECEIPT_VERSION,
    recordSchedulerExecutionObservation,
} from '../services/schedulerExecutionReceipt.mjs';
import { incrementSchedulerExecutionReceipt } from '../services/schedulerExecutionReceiptRepository.mjs';
import { createSchedulerExecutionReceiptService } from '../services/schedulerExecutionReceiptService.mjs';
import { createSchedulerTaskExecutionRunner } from '../services/schedulerTaskExecutionRunner.mjs';

describe('scheduler execution receipt contract', () => {
    test('builds fixed task-class, outcome, and duration buckets', () => {
        expect(buildSchedulerExecutionReceipt({
            taskName: 'library-sync',
            outcomeId: SCHEDULER_EXECUTION_OUTCOME_IDS.COMPLETED,
            durationMs: 24,
        })).toEqual({
            version: SCHEDULER_EXECUTION_RECEIPT_VERSION,
            taskClass: 'library_observation',
            outcomeId: 'completed',
            durationBucket: '5_to_24ms',
            observationCount: 1,
        });
    });

    test('does not retain task names and samples no duration for skipped outcomes', () => {
        expect(buildSchedulerExecutionReceipt({
            taskName: 'future-static-task-name',
            outcomeId: SCHEDULER_EXECUTION_OUTCOME_IDS.CRON_OVERLAP,
            durationMs: 5_000,
        })).toMatchObject({
            taskClass: 'other',
            durationBucket: 'not_sampled',
        });
    });

    test('groups the event-loop observation task with other fixed observations', () => {
        expect(buildSchedulerExecutionReceipt({
            taskName: 'event-loop-delay-observation',
            outcomeId: SCHEDULER_EXECUTION_OUTCOME_IDS.COMPLETED,
            durationMs: 5,
        })).toMatchObject({
            taskClass: 'observation',
            durationBucket: '5_to_24ms',
        });
    });

    test('groups source replay history and retention without exposing its task name', () => {
        expect(buildSchedulerExecutionReceipt({
            taskName: 'source-identity-evidence-replay-observation',
            outcomeId: SCHEDULER_EXECUTION_OUTCOME_IDS.COMPLETED,
            durationMs: 100,
        })).toMatchObject({ taskClass: 'observation', durationBucket: '100_to_499ms' });
        expect(buildSchedulerExecutionReceipt({
            taskName: 'source-identity-evidence-replay-observation-retention',
            outcomeId: SCHEDULER_EXECUTION_OUTCOME_IDS.COMPLETED,
            durationMs: 4,
        })).toMatchObject({ taskClass: 'retention', durationBucket: 'under_5ms' });
    });

    test('rejects caller-controlled outcomes and invalid monotonic timings', () => {
        expect(() => buildSchedulerExecutionReceipt({
            taskName: 'library-sync',
            outcomeId: 'route_media',
        })).toThrow(TypeError);
        expect(elapsedSchedulerMilliseconds(8n, 5n)).toBeNull();
        expect(elapsedSchedulerMilliseconds(5n, 5_005_000n)).toBeCloseTo(5.004995, 9);
    });

    test('contains optional recorder faults outside scheduler execution', async () => {
        const observation = {
            taskName: 'library-sync',
            outcomeId: SCHEDULER_EXECUTION_OUTCOME_IDS.COMPLETED,
        };
        expect(recordSchedulerExecutionObservation({ record: () => { throw new Error('offline'); } }, observation))
            .toBeNull();
        await expect(recordSchedulerExecutionObservation({
            record: () => Promise.reject(new Error('offline')),
        }, observation)).resolves.toBeNull();
        expect(recordSchedulerExecutionObservation(null, observation)).toBeNull();
    });
});

describe('scheduler execution receipt persistence', () => {
    test('uses a parameterized fixed-dimension upsert', async () => {
        const query = jest.fn().mockResolvedValue({});
        const receipt = buildSchedulerExecutionReceipt({
            taskName: 'retry-queue',
            outcomeId: SCHEDULER_EXECUTION_OUTCOME_IDS.FAILED,
            durationMs: 101,
        });

        await incrementSchedulerExecutionReceipt({ query }, receipt);

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT'),
            ['queue', 'failed', SCHEDULER_EXECUTION_RECEIPT_VERSION, '100_to_499ms', 1],
        );
    });

    test('coalesces identical observations and absorbs persistence failures', async () => {
        const incrementReceipt = jest.fn().mockResolvedValue(undefined);
        const logger = { warn: jest.fn() };
        const service = createSchedulerExecutionReceiptService({ incrementReceipt, logger });
        const observation = {
            taskName: 'retry-queue',
            outcomeId: SCHEDULER_EXECUTION_OUTCOME_IDS.COMPLETED,
            durationMs: 20,
        };

        service.record(observation);
        service.record(observation);
        expect(service.pendingCount()).toBe(1);
        await service.flush();
        expect(incrementReceipt).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            observationCount: 2,
        }));

        const failed = createSchedulerExecutionReceiptService({
            incrementReceipt: jest.fn().mockRejectedValue(new Error('offline')),
            logger,
        });
        failed.record(observation);
        await expect(failed.flush()).resolves.toHaveLength(1);
        expect(logger.warn).toHaveBeenCalledWith(
            'Scheduler execution receipt persistence failed',
            { reasonCode: 'scheduler_execution_receipt_persistence_failed' },
            { skipDbPersist: true },
        );
    });
});

describe('scheduler task execution runner', () => {
    function createRunner({ withSessionAdvisoryLock = jest.fn(), receiptRecorder = { record: jest.fn() } } = {}) {
        const logger = {
            debug: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
        };
        return {
            logger,
            receiptRecorder,
            runner: createSchedulerTaskExecutionRunner({
                withSessionAdvisoryLock,
                logger,
                receiptRecorder,
            }),
        };
    }

    test('prevents a delayed-start invocation from overlapping an active task in-process', async () => {
        const { runner, logger, receiptRecorder } = createRunner();
        let release;
        const handler = jest.fn(() => new Promise(resolve => { release = resolve; }));

        const firstRun = runner.run({ name: 'retry-queue', handler });
        await Promise.resolve();
        await Promise.resolve();

        await expect(runner.run({ name: 'retry-queue', handler })).resolves.toBe(false);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(logger.debug).toHaveBeenCalledWith(
            'Scheduled task retry-queue skipped — already running in this process',
        );
        expect(receiptRecorder.record).toHaveBeenCalledWith(expect.objectContaining({
            taskName: 'retry-queue',
            outcomeId: 'in_process_overlap',
        }));

        release();
        await expect(firstRun).resolves.toBe(true);
    });

    test('records advisory-lock skips and failures without collecting error text', async () => {
        const withSessionAdvisoryLock = jest.fn().mockResolvedValue(false);
        const { runner, receiptRecorder } = createRunner({ withSessionAdvisoryLock });

        await expect(runner.run({ name: 'library-sync', handler: jest.fn(), lockKey: 8 })).resolves.toBe(false);
        await expect(runner.run({
            name: 'library-sync',
            handler: jest.fn().mockRejectedValue(new Error('not persisted')),
        })).resolves.toBe(false);

        expect(receiptRecorder.record).toHaveBeenNthCalledWith(1, expect.objectContaining({
            taskName: 'library-sync',
            outcomeId: 'advisory_lock_held',
            durationMs: null,
        }));
        expect(receiptRecorder.record).toHaveBeenNthCalledWith(2, expect.objectContaining({
            taskName: 'library-sync',
            outcomeId: 'failed',
            durationMs: expect.any(Number),
        }));
    });

    test('records node-cron overlap events when the task exposes its lifecycle API', () => {
        const { runner, logger, receiptRecorder } = createRunner();
        let overlapHandler;
        runner.observeCronOverlap({
            on: jest.fn((eventName, handler) => {
                if (eventName === 'execution:overlap') overlapHandler = handler;
            }),
        }, 'gap-analysis');

        overlapHandler();
        expect(logger.debug).toHaveBeenCalledWith(
            'Scheduled task gap-analysis skipped — previous run still active',
        );
        expect(receiptRecorder.record).toHaveBeenCalledWith({
            taskName: 'gap-analysis',
            outcomeId: 'cron_overlap',
            durationMs: null,
        });
    });
});

describe('scheduler cron options', () => {
    test('enforces no-overlap while preserving supported node-cron options', () => {
        expect(createSchedulerCronOptions({ name: 'cleanup', unref: true })).toEqual({
            name: 'cleanup',
            unref: true,
            noOverlap: true,
        });
        expect(() => createSchedulerCronOptions({ noOverlap: false })).toThrow(TypeError);
        expect(() => createSchedulerCronOptions(null)).toThrow(TypeError);
    });
});
