/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { QueueRefillService, REFILL_QUEUE_BATCH_LIMIT } from '../services/queueRefillService.mjs';
import { readRefillCandidatePage } from '../services/queueRefillCandidates.mjs';
import { inventoryObservationValidityCases } from './helpers/inventoryObservationValidityCases.mjs';

const now = new Date('2026-09-05T12:00:00Z');
const row = (record, overrides = {}) => ({ id: 1, through_id: 6000, media_type: 'movie', tmdb_id: 7,
    needs_standard_enrichment: false, metadata: { inventory_tmdb: record },
    inventory_tmdb_checked_at: now, inventory_tmdb_fetched_at: now,
    inventory_tmdb_attempted_at: new Date(now.getTime() - 7 * 3600000), ...overrides });
const logger = () => ({ debug: jest.fn(), info: jest.fn(), error: jest.fn() });

test.each(inventoryObservationValidityCases)('fresh $name has explicit reusable=$reusable', async ({ record, reusable }) => {
    const item = row(record);
    const page = await readRefillCandidatePage({ query: jest.fn().mockResolvedValue({ rows: [item] }) }, null);
    expect(page.rows).toEqual(reusable ? [] : [item]);
});

test.each([
    ['fresh', 0, 7, false], ['expiry boundary', 30, 7, true], ['future fetch', -1, 7, true],
    ['retry boundary', 31, 6, true], ['backoff', 31, 5, false],
    ['future attempt', 31, -1, false],
])('%s uses the database clock and existing boundaries', async (_name, days, hours, due) => {
    const item = row(inventoryObservationValidityCases[0].record, {
        inventory_tmdb_fetched_at: new Date(now.getTime() - days * 86400000),
        inventory_tmdb_attempted_at: new Date(now.getTime() - hours * 3600000),
    });
    const page = await readRefillCandidatePage({ query: jest.fn().mockResolvedValue({ rows: [item] }) });
    expect(page.rows).toHaveLength(due ? 1 : 0);
});

test('a full fresh page advances progress; a short page wraps the next call', async () => {
    const fresh = Array.from({ length: REFILL_QUEUE_BATCH_LIMIT }, (_, n) => row(inventoryObservationValidityCases[1].record, { id: n + 1 }));
    const broken = row(null, { id: 5001 });
    const query = jest.fn().mockResolvedValueOnce({ rows: fresh }).mockResolvedValueOnce({ rows: [broken] }).mockResolvedValueOnce({ rows: [] });
    const service = new QueueRefillService({ db: { query } });
    expect(await service.selectRefillCandidates()).toEqual([]);
    expect(await service.selectRefillCandidates()).toEqual([broken]);
    expect(await service.selectRefillCandidates()).toEqual([]);
    expect(query.mock.calls.map(call => call[1])).toEqual([[6, 0, null], [6, 5000, 6000], [6, 0, null]]);
});

test('read failure preserves the current checkpoint', async () => {
    const query = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ rows: [] });
    const service = new QueueRefillService({ db: { query } });
    service.refillCursor = { afterId: 40, throughId: 70 };
    await expect(service.selectRefillCandidates()).rejects.toThrow('offline');
    await service.selectRefillCandidates();
    expect(query.mock.calls.map(call => call[1])).toEqual([[6, 40, 70], [6, 40, 70]]);
});

test('enqueue failure restores the checkpoint and permits retry', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [row(null)] });
    const enqueueTask = jest.fn().mockRejectedValueOnce(new Error('queue unavailable')).mockResolvedValue(undefined);
    const service = new QueueRefillService({ db: { query }, enqueueTask, logger: logger() });
    service.refillCursor = { afterId: 40, throughId: 70 };
    await expect(service.refillQueue()).rejects.toThrow('queue unavailable');
    await expect(service.refillQueue()).resolves.toEqual({ queued: 1 });
    expect(query.mock.calls.map(call => call[1])).toEqual([[6, 40, 70], [6, 40, 70]]);
});

test('overlapping refills share selection and enqueue completion', async () => {
    let finish;
    const enqueueTask = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const query = jest.fn().mockResolvedValue({ rows: [row(null)] });
    const service = new QueueRefillService({ db: { query }, enqueueTask, logger: logger() });
    const first = service.refillQueue();
    await new Promise(resolve => { setImmediate(resolve); });
    const second = service.refillQueue();
    expect(enqueueTask).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    finish();
    expect(await Promise.all([first, second])).toEqual([{ queued: 1 }, { queued: 1 }]);
});
