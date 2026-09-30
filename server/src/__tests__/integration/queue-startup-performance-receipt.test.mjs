/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';

// Exercise the real scope-guarded wrapper against the disposable suite database.
jest.unstable_unmockModule('../../config/database.mjs');
const { createDatabaseModule } = await import('../../config/database.mjs');
const { createQueueStartupPerformanceReceiptService } = await import('../../services/queueStartupPerformanceReceiptService.mjs');

const observation = { operationId: 'queue_refill_candidates', durationMs: 20, scannedIdCount: 5, candidateCount: 2 };
const services = [];
function create(options = {}) {
    const database = createDatabaseModule({
        pgModule: { Pool: class { constructor() { return getPool(); } } },
        loggerFactory: () => ({ warn: jest.fn(), error: jest.fn() }),
        environment: { NODE_ENV: 'production', POSTGRES_CONNECT_RETRIES: '0' },
    });
    const service = createQueueStartupPerformanceReceiptService({ database, logger: { warn: jest.fn() }, ...options });
    services.push(service);
    return { database, service };
}
afterEach(() => { for (const service of services.splice(0)) service.stop(); });

test('delayed anonymous receipt persists after real advisory unlock; retained inventory write stays rejected', async () => {
    const written = Promise.withResolvers();
    const logger = { warn: jest.fn(() => written.reject(new Error('receipt_write_failed'))) };
    const { database, service } = create({ logger, flushDelayMs: 5 });
    const lockFinished = Promise.withResolvers();
    // Observe completion without substituting either SQL or the database wrapper.
    const originalQuery = database.query;
    database.query = async (...args) => {
        await lockFinished.promise;
        const result = await originalQuery(...args);
        written.resolve();
        return result;
    };
    const resume = Promise.withResolvers();
    let lateWrite;
    await database.withSessionAdvisoryLock(987654321, async () => {
        service.record(observation);
        service.record(observation);
        lateWrite = resume.promise.then(() => originalQuery('DELETE FROM media_server_items WHERE false'));
    });
    lockFinished.resolve();
    const deadline = setTimeout(() => written.reject(new Error('receipt_not_flushed')), 3000);
    try {
        await written.promise;
        resume.resolve();
        await expect(lateWrite).rejects.toThrow('database_lock_scope_closed');
        const { rows } = await getPool().query('SELECT observation_count FROM queue_startup_performance_receipts');
        expect(rows).toEqual([{ observation_count: 2 }]);
        expect(logger.warn).not.toHaveBeenCalled();
    } finally {
        clearTimeout(deadline);
        resume.resolve();
        await lateWrite.catch(() => {}); // swallow-error: cleanup consumes the expected rejection without masking the primary assertion.
        await service.flush();
    }
});

test('independent lifecycle writers aggregate atomically without duplicate replay', async () => {
    const first = create().service;
    const second = create().service;
    const health = { operationId: 'queue_worker_health', durationMs: 1 };
    first.record(health);
    first.record(health);
    second.record(health);
    await Promise.all([first.flush(), second.flush(), first.flush()]);
    const { rows } = await getPool().query("SELECT observation_count FROM queue_startup_performance_receipts WHERE operation_id = 'queue_worker_health'");
    expect(rows).toEqual([{ observation_count: 3 }]);
});

test('actual PostgreSQL rejection is safely categorized; next observation recovers without replay', async () => {
    const logger = { warn: jest.fn() };
    const { service } = create({ logger });
    await getPool().query('ALTER TABLE queue_startup_performance_receipts RENAME TO receipt_unavailable_fixture');
    try {
        service.record({ ...observation, durationMs: 800 });
        await service.flush();
        expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
            reasonCode: 'queue_startup_performance_receipt_persistence_failed',
            errorCategory: 'database_rejected', code: '42P01',
        }, { skipDbPersist: true });
    } finally {
        await getPool().query('ALTER TABLE receipt_unavailable_fixture RENAME TO queue_startup_performance_receipts');
    }
    service.record({ ...observation, durationMs: 800 });
    await service.flush();
    const { rows } = await getPool().query("SELECT observation_count FROM queue_startup_performance_receipts WHERE duration_bucket = '500ms_or_more'");
    expect(rows).toEqual([{ observation_count: 1 }]);
});
