/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, describe, expect, test } from '@jest/globals';
import {
    buildQueueStartupPerformanceReceipt,
    elapsedMilliseconds,
    QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS,
    QUEUE_STARTUP_PERFORMANCE_RECEIPT_VERSION,
    recordQueueStartupPerformanceObservation,
} from '../services/queueStartupPerformanceReceipt.mjs';
import { incrementQueueStartupPerformanceReceipt } from '../services/queueStartupPerformanceReceiptRepository.mjs';
import { createQueueStartupPerformanceReceiptService } from '../services/queueStartupPerformanceReceiptService.mjs';
import { createQueueWorkerHealthCheck } from '../services/healthCheckInfrastructure.mjs';

describe('queue startup performance receipt contract', () => {
    test('builds fixed anonymous buckets for a refill read', () => {
        expect(buildQueueStartupPerformanceReceipt({
            operationId: QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS.QUEUE_REFILL_CANDIDATES,
            durationMs: 103,
            scannedIdCount: 5000,
            candidateCount: 27,
        })).toEqual({
            version: QUEUE_STARTUP_PERFORMANCE_RECEIPT_VERSION,
            operationId: 'queue_refill_candidates',
            durationBucket: '100_to_499ms',
            scannedIdBucket: '5000_or_more',
            candidateCountBucket: '1_to_99',
            bufferBucket: 'not_sampled',
            observationCount: 1,
        });
    });

    test('uses not-applicable count buckets for the queue health aggregate', () => {
        expect(buildQueueStartupPerformanceReceipt({
            operationId: QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS.QUEUE_WORKER_HEALTH,
            durationMs: 2,
            scannedIdCount: 999999,
            candidateCount: 999999,
        })).toMatchObject({
            durationBucket: 'under_5ms',
            scannedIdBucket: 'not_applicable',
            candidateCountBucket: 'not_applicable',
            bufferBucket: 'not_sampled',
        });
    });

    test('rejects a caller-controlled operation dimension and accepts only monotonic timing', () => {
        expect(() => buildQueueStartupPerformanceReceipt({ operationId: 'route_media' })).toThrow(TypeError);
        expect(elapsedMilliseconds(8n, 5n)).toBeNull();
        expect(elapsedMilliseconds(5n, 5_005_000n)).toBeCloseTo(5.004995, 9);
    });

    test('contains optional recorder faults outside observed operations', () => {
        const observation = { operationId: QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS.QUEUE_WORKER_HEALTH };
        expect(recordQueueStartupPerformanceObservation({ record: () => { throw new Error('offline'); } }, observation)).toBeNull();
        expect(recordQueueStartupPerformanceObservation(null, observation)).toBeNull();
    });
});

describe('queue startup performance receipt persistence', () => {
    test('uses a parameterized fixed-dimension upsert', async () => {
        const query = jest.fn().mockResolvedValue({});
        const receipt = buildQueueStartupPerformanceReceipt({
            operationId: QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS.QUEUE_REFILL_CANDIDATES,
            durationMs: 20,
            scannedIdCount: 0,
            candidateCount: 0,
        });

        await incrementQueueStartupPerformanceReceipt({ query }, receipt);

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT'),
            ['queue_refill_candidates', QUEUE_STARTUP_PERFORMANCE_RECEIPT_VERSION, '5_to_24ms', 'zero', 'zero', 'not_sampled', 1],
        );
    });

    test('coalesces identical observations and absorbs persistence failures', async () => {
        const incrementReceipt = jest.fn().mockResolvedValue(undefined);
        const logger = { warn: jest.fn() };
        const service = createQueueStartupPerformanceReceiptService({ incrementReceipt, logger });
        const observation = {
            operationId: QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS.QUEUE_REFILL_CANDIDATES,
            durationMs: 20,
            scannedIdCount: 5,
            candidateCount: 2,
        };

        service.record(observation);
        service.record(observation);
        expect(service.pendingCount()).toBe(1);
        await service.flush();
        expect(incrementReceipt).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ observationCount: 2 }));

        const failed = createQueueStartupPerformanceReceiptService({
            incrementReceipt: jest.fn().mockRejectedValue(new Error('offline')),
            logger,
        });
        failed.record(observation);
        await expect(failed.flush()).resolves.toHaveLength(1);
        expect(logger.warn).toHaveBeenCalledWith(
            'Queue startup performance receipt persistence failed',
            { reasonCode: 'queue_startup_performance_receipt_persistence_failed' },
            { skipDbPersist: true },
        );
    });
});

test('queue worker health emits a receipt without changing its public health contract', async () => {
    const record = jest.fn();
    const checkQueueWorker = createQueueWorkerHealthCheck({
        database: { query: jest.fn().mockResolvedValue({ rows: [{ processing: '1', pending: '2', last_activity: null }] }) },
        performanceReceiptRecorder: { record },
    });

    await expect(checkQueueWorker()).resolves.toMatchObject({
        name: 'Queue Worker',
        status: 'connected',
        metadata: { processing: 1, pending: 2 },
    });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
        operationId: QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS.QUEUE_WORKER_HEALTH,
    }));
});

test('queue worker health remains connected when optional receipt collection fails', async () => {
    const checkQueueWorker = createQueueWorkerHealthCheck({
        database: { query: jest.fn().mockResolvedValue({ rows: [{ processing: '1', pending: '2', last_activity: null }] }) },
        performanceReceiptRecorder: { record: () => { throw new Error('offline'); } },
    });

    await expect(checkQueueWorker()).resolves.toMatchObject({ status: 'connected' });
});
