/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { afterEach, expect, jest, test } from '@jest/globals';
import { createDatabaseLockScope } from '../utils/databaseLockScope.mjs';
import { createQueueStartupPerformanceReceiptService } from '../services/queueStartupPerformanceReceiptService.mjs';
import { warnQueueStartupPerformanceReceiptFailure } from '../services/queueStartupPerformanceReceiptDiagnostics.mjs';

const observation = { operationId: 'queue_refill_candidates', durationMs: 20, scannedIdCount: 5, candidateCount: 2 };
const services = [];
function create(options = {}) {
    const service = createQueueStartupPerformanceReceiptService({ logger: { warn: jest.fn() }, ...options });
    services.push(service);
    return service;
}
afterEach(() => {
    for (const service of services.splice(0)) service.stop?.();
    jest.restoreAllMocks();
    jest.useRealTimers();
});

test('delayed receipts persist outside a closed lock; detached inventory work remains forbidden', async () => {
    const scope = createDatabaseLockScope();
    const written = Promise.withResolvers();
    const database = { query: jest.fn(async () => { scope.assertHealthy(); written.resolve(); }) };
    const logger = { warn: jest.fn(() => written.reject(new Error('receipt_write_failed'))) };
    const service = create({ database, logger, flushDelayMs: 5 });
    const resume = Promise.withResolvers();
    let late;
    await scope.run({ assertHealthy() {} }, async () => {
        service.record(observation);
        late = resume.promise.then(() => scope.assertHealthy());
    });
    const deadline = setTimeout(() => written.reject(new Error('receipt_not_flushed')), 1000);
    try {
        await written.promise;
        resume.resolve();
        await expect(late).rejects.toThrow('database_lock_scope_closed');
        expect(database.query).toHaveBeenCalledTimes(1);
        expect(logger.warn).not.toHaveBeenCalled();
    } finally {
        clearTimeout(deadline);
        // Consume the detached result even if the receipt assertion failed.
        resume.resolve();
        await late.catch(() => {}); // swallow-error: cleanup consumes the expected rejection without masking the primary assertion.
    }
});

test('manual flush also uses startup context and restores the caller context afterwards', async () => {
    const caller = new AsyncLocalStorage();
    const seen = [];
    const incrementReceipt = jest.fn(async () => { seen.push(caller.getStore()); });
    const service = create({ incrementReceipt });
    await caller.run('request-private-context', async () => {
        service.record(observation);
        await service.flush();
        expect(caller.getStore()).toBe('request-private-context');
    });
    expect(incrementReceipt).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([undefined]);
});

test('a mistakenly scoped constructor is not a generic bypass of its captured lock', async () => {
    const scope = createDatabaseLockScope();
    const logger = { warn: jest.fn() };
    let service;
    await scope.run({ assertHealthy() {} }, async () => {
        service = create({ database: { query: async () => scope.assertHealthy() }, logger });
        service.record(observation);
    });
    await service.flush();
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        errorCategory: 'ownership_scope_closed',
    }), { skipDbPersist: true });
});

test('idle service creates no timer; records coalesce under one unref timer', async () => {
    jest.useFakeTimers();
    const timerSpy = jest.spyOn(globalThis, 'setTimeout');
    const incrementReceipt = jest.fn();
    const service = create({ incrementReceipt });
    expect(jest.getTimerCount()).toBe(0);
    service.record(observation);
    service.record(observation);
    expect(jest.getTimerCount()).toBe(1);
    expect(timerSpy.mock.results[0].value.hasRef()).toBe(false);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(incrementReceipt).toHaveBeenCalledTimes(1);
    expect(incrementReceipt).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ observationCount: 2 }));
    expect(jest.getTimerCount()).toBe(0);
});

test('overlapping flushes share one batch and records during it wait for the next timer', async () => {
    jest.useFakeTimers();
    const gate = Promise.withResolvers();
    const incrementReceipt = jest.fn().mockReturnValueOnce(gate.promise).mockResolvedValue(undefined);
    const service = create({ incrementReceipt, flushDelayMs: 10 });
    service.record(observation);
    const first = service.flush();
    expect(service.flush()).toBe(first);
    await Promise.resolve();
    service.record(observation);
    service.record(observation);
    expect(service.flush()).toBe(first);
    await jest.advanceTimersByTimeAsync(100);
    expect(incrementReceipt).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    gate.resolve();
    await first;
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(10);
    expect(incrementReceipt).toHaveBeenCalledTimes(2);
    expect(incrementReceipt.mock.calls.map(([, receipt]) => receipt.observationCount)).toEqual([1, 2]);
    expect(service.pendingCount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
});

test('shutdown drops pending optional counts, stops the active batch and destroys the context once', async () => {
    jest.useFakeTimers();
    const destroyed = jest.spyOn(AsyncResource.prototype, 'emitDestroy');
    const gate = Promise.withResolvers();
    const incrementReceipt = jest.fn().mockReturnValue(gate.promise);
    const service = create({ incrementReceipt });
    service.record(observation);
    service.record({ ...observation, durationMs: 800 });
    const active = service.flush();
    await Promise.resolve();
    service.record(observation);
    service.stop();
    service.stop();
    expect(service.pendingCount()).toBe(0);
    expect(service.record(observation)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    expect(destroyed).not.toHaveBeenCalled();
    gate.resolve();
    await active;
    await expect(service.flush()).resolves.toEqual([]);
    expect(incrementReceipt).toHaveBeenCalledTimes(1);
    expect(destroyed).toHaveBeenCalledTimes(1);
});

test('stopping before the timer fires never writes or keeps a timer alive', async () => {
    jest.useFakeTimers();
    const destroyed = jest.spyOn(AsyncResource.prototype, 'emitDestroy');
    const incrementReceipt = jest.fn();
    const service = create({ incrementReceipt });
    service.record(observation);
    service.stop();
    service.stop();
    await jest.runAllTimersAsync();
    expect(incrementReceipt).not.toHaveBeenCalled();
    expect(destroyed).toHaveBeenCalledTimes(1);
});

test.each(['throw', 'reject'])('failed writes and a logger that can %s remain optional without replay', async failure => {
    jest.useFakeTimers();
    const incrementReceipt = jest.fn().mockRejectedValueOnce(new Error('private details')).mockResolvedValue(undefined);
    const logger = { warn: jest.fn(() => {
        if (failure === 'throw') throw new Error('logger failed');
        return Promise.reject(new Error('logger failed'));
    }) };
    const service = create({ incrementReceipt, logger });
    service.record(observation);
    service.record({ ...observation, durationMs: 800 });
    await expect(service.flush()).resolves.toHaveLength(2);
    await jest.runAllTimersAsync();
    expect(incrementReceipt).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    service.record(observation);
    await service.flush();
    expect(incrementReceipt).toHaveBeenCalledTimes(2);
    expect(incrementReceipt.mock.calls[1][1].observationCount).toBe(1);
});

test.each([
    ['08000', 'connection_unavailable'], ['08003', 'connection_unavailable'], ['08006', 'connection_unavailable'],
    ['57P01', 'connection_unavailable'], ['57P02', 'connection_unavailable'], ['57P03', 'connection_unavailable'],
    ['ECONNRESET', 'connection_unavailable'], ['ECONNREFUSED', 'connection_unavailable'],
    ['ETIMEDOUT', 'connection_unavailable'], ['EPIPE', 'connection_unavailable'],
    ['42501', 'database_rejected'], ['42P01', 'database_rejected'], ['23514', 'database_rejected'],
    ['22003', 'database_rejected'], ['53300', 'database_rejected'], ['57014', 'database_rejected'],
])('diagnostics retain only approved code %s', (code, errorCategory) => {
    const logger = { warn: jest.fn() };
    warnQueueStartupPerformanceReceiptFailure(logger, { code, message: 'PRIVATE query/config', detail: 'PRIVATE' });
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
        reasonCode: 'queue_startup_performance_receipt_persistence_failed', errorCategory, code,
    }, { skipDbPersist: true });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('PRIVATE');
});

test.each([null, 'PRIVATE', { code: 'SECRET', message: 'PRIVATE' }])('unknown failures never expose caller-controlled text %#', error => {
    const logger = { warn: jest.fn() };
    warnQueueStartupPerformanceReceiptFailure(logger, error);
    expect(logger.warn.mock.calls[0][1]).toEqual({
        reasonCode: 'queue_startup_performance_receipt_persistence_failed', errorCategory: 'unknown',
    });
});

test('diagnostics snapshot codes once and contain throwing accessors', () => {
    const logger = { warn: jest.fn() };
    let reads = 0;
    warnQueueStartupPerformanceReceiptFailure(logger, {
        get code() { reads += 1; return reads === 1 ? '42501' : 'PRIVATE'; },
    });
    expect(reads).toBe(1);
    expect(logger.warn.mock.calls[0][1].code).toBe('42501');
    expect(() => warnQueueStartupPerformanceReceiptFailure(logger, {
        get code() { throw new Error('PRIVATE'); },
    })).not.toThrow();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('PRIVATE');
});

test('only 156 fixed receipt keys are retained despite repeated observations and extra private fields', async () => {
    const incrementReceipt = jest.fn();
    const service = create({ incrementReceipt });
    for (const durationMs of [-1, 1, 5, 25, 100, 500]) {
        service.record({ operationId: 'queue_worker_health', durationMs });
        for (const scannedIdCount of [0, 1, 100, 1000, 5000]) {
            for (const candidateCount of [0, 1, 100, 1000, 5000]) {
                service.record({ ...observation, durationMs, scannedIdCount, candidateCount, title: 'PRIVATE' });
            }
        }
    }
    for (let i = 0; i < 1000; i += 1) service.record(observation);
    expect(service.pendingCount()).toBe(156);
    const batch = await service.flush();
    expect(incrementReceipt).toHaveBeenCalledTimes(156);
    expect(JSON.stringify(batch)).not.toContain('PRIVATE');
    expect(batch.reduce((sum, receipt) => sum + receipt.observationCount, 0)).toBe(1156);
    expect(() => service.record({ operationId: 'caller_sql' })).toThrow(TypeError);
    expect(service.pendingCount()).toBe(0);
});
