/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { registerLiveMultiScaleSchedule, createLiveMultiScaleRuntime } from '../../services/liveMultiScaleScheduler.mjs';
import { installLiveMultiScaleContext, retrieveLiveMultiScaleExamples } from '../../services/liveMultiScaleRuntime.mjs';
import { liveFixture } from '../fixtures/liveMultiScaleFixture.mjs';
import { INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';

test('production runtime wires shared admission before provider or vector snapshot work', async () => {
  const { state } = liveFixture();
  const database = { withTransaction: jest.fn(callback => callback({ query: async () => ({ rows: [state] }) })),
    withSessionAdvisoryLock: jest.fn(async () => false) };
  const runtime = createLiveMultiScaleRuntime(database);
  expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'busy' });
  expect(database.withSessionAdvisoryLock).toHaveBeenCalledWith(INVENTORY_DISCOVERY_LOCK, expect.any(Function));
  expect(database.withTransaction).toHaveBeenCalledTimes(1); runtime.stop();
});

test('scheduler owns installation, periodic recovery, replacement and cleanup', async () => {
  const previous = { stop: jest.fn() }, scheduler = { liveMultiScaleWorker: previous, schedule: jest.fn(), scheduleInitial: jest.fn() };
  const worker = { stop: jest.fn(), run: jest.fn(async () => ({ status: 'ready' })), retrieve: jest.fn(async () => 'examples') };
  const log = { info: jest.fn(), warn: jest.fn() };
  registerLiveMultiScaleSchedule(scheduler, { worker, log });
  expect(previous.stop).toHaveBeenCalledTimes(1);
  const run = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.schedule).toHaveBeenCalledWith('inventory-multi-scale-context', '45 * * * * *', run, null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith('inventory-multi-scale-context', 180000, run);
  expect(await run()).toEqual({ status: 'ready' });
  worker.run.mockResolvedValue({ status: 'unavailable' }); await run(); await run();
  worker.run.mockResolvedValueOnce({ status: 'not_due' }); await run();
  await run(); expect(log.warn).toHaveBeenCalledTimes(1);
  worker.run.mockResolvedValue({ status: 'revalidated' }); await run(); await run();
  expect(log.info).toHaveBeenCalledTimes(1);
  expect(await retrieveLiveMultiScaleExamples({})).toBe('examples');
  scheduler.liveMultiScaleWorker.stop(); expect(worker.stop).toHaveBeenCalledTimes(1);
  expect(await retrieveLiveMultiScaleExamples({})).toBeNull();
});

test('stale owners cannot disconnect replacements and errors never escape optional retrieval', async () => {
  const first = installLiveMultiScaleContext({ retrieve: async () => 'old' });
  const second = installLiveMultiScaleContext({ retrieve: async () => { throw new Error('PRIVATE'); } });
  first(); expect(await retrieveLiveMultiScaleExamples({})).toBeNull(); second();
  const third = installLiveMultiScaleContext({ retrieve: async () => 'new' });
  first(); expect(await retrieveLiveMultiScaleExamples({})).toBe('new'); third();
});

test('runtime construction is inert and disabled configuration performs no model work', async () => {
  const database = { withTransaction: async callback => callback({ query: async () => ({ rows: [{ rag_enabled: false }] }) }) };
  const runtime = createLiveMultiScaleRuntime(database);
  expect(await runtime.run()).toEqual({ status: 'disabled' }); runtime.stop();
  expect(await runtime.run()).toEqual({ status: 'cancelled' });
});
