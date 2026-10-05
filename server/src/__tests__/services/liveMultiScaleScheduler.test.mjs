/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { registerLiveMultiScaleSchedule, createLiveMultiScaleRuntime } from '../../services/liveMultiScaleScheduler.mjs';
import { installLiveMultiScaleContext, retrieveLiveMultiScaleExamples } from '../../services/liveMultiScaleRuntime.mjs';
import { liveFixture } from '../fixtures/liveMultiScaleFixture.mjs';
import { INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';

test('production runtime wires shared admission before provider or vector snapshot work', async () => {
  const { state } = liveFixture();
  const database = { withTransaction: jest.fn(callback => callback({ query: async () => ({ rows: [{ ...state, readiness: 'ready' }] }) })),
    withSessionAdvisoryLock: jest.fn(async () => false) };
  const runtime = createLiveMultiScaleRuntime(database);
  expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'busy' });
  expect(database.withSessionAdvisoryLock).toHaveBeenCalledWith(INVENTORY_DISCOVERY_LOCK, expect.any(Function));
  expect(database.withTransaction).toHaveBeenCalledTimes(2); runtime.stop();
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
  const database = { withTransaction: async callback => callback({ query: async () => ({ rows: [{ readiness: 'disabled' }] }) }) };
  const runtime = createLiveMultiScaleRuntime(database);
  expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'disabled' }); runtime.stop();
  expect(await runtime.run()).toEqual({ status: 'stopped' });
});

test('production readiness failure retains a safe database cause without admitting work', async () => {
  const database = { withTransaction: jest.fn(async () => { throw Object.assign(new Error('PRIVATE SQL'), { code: '42501' }); }),
    withSessionAdvisoryLock: jest.fn() };
  const runtime = createLiveMultiScaleRuntime(database);
  try {
    expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'unavailable', failure: { stage: 'readiness', code: 'database_permissions' } });
    expect(database.withSessionAdvisoryLock).not.toHaveBeenCalled();
  } finally { runtime.stop(); }
});

test('a changed failing stage or cause produces new evidence while identical failures stay quiet', async () => {
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  const worker = { stop: jest.fn(), run: jest.fn() }, log = { info: jest.fn(), warn: jest.fn() };
  registerLiveMultiScaleSchedule(scheduler, { worker, log });
  const run = scheduler.schedule.mock.calls[0][2];
  try {
    for (const failure of [{ stage: 'snapshot_read', code: 'database_schema' },
      { stage: 'state_read', code: 'database_schema' }, { stage: 'state_read', code: 'database_connection' }]) {
      worker.run.mockResolvedValue({ status: 'unavailable', failure });
      await run(); await run();
      expect(log.warn).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining(failure));
    }
    expect(log.warn).toHaveBeenCalledTimes(3);
    expect(log.info).not.toHaveBeenCalled();
    worker.run.mockResolvedValue({ status: 'ready' }); await run(); await run();
    expect(log.info).toHaveBeenCalledTimes(1);
  } finally { scheduler.liveMultiScaleWorker.stop(); }
});

test('logs changed reasons once and only confirms recovery after ready context', async () => {
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  const worker = { stop: jest.fn(), run: jest.fn() }, log = { info: jest.fn(), warn: jest.fn() };
  registerLiveMultiScaleSchedule(scheduler, { worker, log });
  const run = scheduler.schedule.mock.calls[0][2];
  try {
    worker.run.mockResolvedValue({ status: 'deferred', reason: 'busy' });
    await run(); await run();
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenLastCalledWith(expect.stringContaining('waiting'), expect.objectContaining({ reason: 'busy' }));
    expect(log.warn).not.toHaveBeenCalled();
    worker.run.mockResolvedValue({ status: 'deferred', reason: 'memory_pressure' });
    await run(); await run();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ reason: 'memory_pressure' }));
    worker.run.mockResolvedValue({ status: 'deferred', reason: 'memory_unknown' });
    await run();
    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ reason: 'memory_unknown' }));
    for (const report of [{ status: 'deferred', reason: 'ingesting' }, { status: 'cancelled' }, { status: 'not_due' }]) {
      worker.run.mockResolvedValue(report); await run();
    }
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledTimes(2);
    worker.run.mockResolvedValue({ status: 'revalidated' }); await run(); await run();
    expect(log.info).toHaveBeenCalledTimes(2);
    expect(log.info).toHaveBeenLastCalledWith('Library comparison context recovered automatically');
  } finally { scheduler.liveMultiScaleWorker.stop(); }
});
