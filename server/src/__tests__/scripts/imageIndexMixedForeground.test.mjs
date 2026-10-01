/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';

jest.unstable_mockModule('node:timers/promises', () => ({ setTimeout: () => new Promise(resolve => { setImmediate(resolve); }) }));
let scanned, growing, stop, synced = true;
const syncLibrary = jest.fn(async () => { scanned++; return { success: synced }; });
jest.unstable_mockModule('../../services/mediaSync.mjs', () => ({ MediaSyncService: class { syncLibrary = syncLibrary; } }));
let queue;
jest.unstable_mockModule('../../services/queueService.mjs', () => ({ QueueService: class {
  constructor() { queue = this; }
  processing = 0;
  startWorker = jest.fn(() => new Promise(resolve => { stop = resolve; }));
  stopWorker = jest.fn(() => stop());
  refillQueue = jest.fn(async () => {});
} }));
jest.unstable_mockModule('../../services/queueTaskProcessorService.mjs', () => ({ QueueTaskProcessorService: class {} }));
jest.unstable_mockModule('../../scripts/resourceStudyFixtures.mjs', () => ({
  seedResourceStudyLibraries: async () => Array.from({ length: 4 }, (_, id) => ({ id })),
  createResourceStudyFixture: () => ({ provider: {}, adapter: {}, grow: n => { growing += n; }, get count() { return growing; } }),
}));
const { createImageIndexMixedForeground, summarizeMixedLatency } = await import('../../scripts/imageIndexMixedForeground.mjs');
let old, db, reader, release, query;
beforeEach(() => {
  old = process.env; process.env = { ...old, ...resourceStudyEnvironment };
  scanned = growing = 0; synced = true;
  release = jest.fn(); reader = { query: jest.fn(async () => ({ rows: Array.from({ length: 5 }, (_, id) => ({ id })) })), release };
  query = jest.fn(async sql => sql.includes('AS pending') ? { rows: [{ pending: 0, unfinished: 0 }] }
    : { rows: [{ count: growing * 4, enriched: growing * 4, unsupported: 0 }] });
  db = { query, pool: { connect: jest.fn(async () => reader) } };
});
afterEach(() => { process.env = old; jest.clearAllMocks(); });
test('bounded movie/TV load drains and joins the queue, with fixed retrieval SQL', async () => {
  const run = await createImageIndexMixedForeground(db), progress = jest.fn();
  const result = await run(progress);
  expect(result.inventory).toBe(80); expect(result.retrievals.count).toBe(40);
  expect(progress).toHaveBeenCalledTimes(40); expect(scanned).toBe(4);
  expect(queue.stopWorker).toHaveBeenCalledTimes(1); expect(release).toHaveBeenCalledWith(true);
  expect(reader.query.mock.calls[1][0]).toContain('$1::public.vector LIMIT 5');
  expect(reader.query.mock.calls[1][1][0]).toMatch(/^\[/);
  expect(query.mock.calls[0][0]).toContain('synthetic-only');
});
test('scan failure still joins the worker and releases the reader', async () => {
  synced = false; const run = await createImageIndexMixedForeground(db);
  await expect(run()).rejects.toThrow(); expect(release).toHaveBeenCalledWith(true);
  expect(queue.stopWorker).toHaveBeenCalledTimes(1);
});
test('a rejected reader connection does not start a worker', async () => {
  db.pool.connect.mockRejectedValue(new Error('connection_failed'));
  const run = await createImageIndexMixedForeground(db);
  await expect(run()).rejects.toThrow('connection_failed');
  expect(queue.startWorker).not.toHaveBeenCalled();
});
test('missing isolation guard refuses fixture writes', async () => {
  delete process.env.CLASSIFARR_UPGRADE_DRILL;
  await expect(createImageIndexMixedForeground(db)).rejects.toThrow(); expect(query).not.toHaveBeenCalled();
});
test('nearest-rank latency keeps a finite nonempty bounded population', () => {
  expect(summarizeMixedLatency([3, 1, 2])).toEqual({ count: 3, p50Ms: 2, p95Ms: 3, maxMs: 3 });
  for (const values of [[], [NaN], [-1], Array(401).fill(1)]) expect(() => summarizeMixedLatency(values)).toThrow();
});
