/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { withInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { DiscoveryDeferredError } from '../../services/inventoryDiscoveryAdmission.mjs';
import { registerInventoryRepresentativeProfileSchedule } from '../../services/inventoryRepresentativeProfileScheduler.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { discoveryAdmissionFixture } from '../helpers/discoveryAdmissionFixture.mjs';

const MIB = 1024 ** 2;
function setup() {
  const fixture = representativeProfileFixture();
  const control = { time: 0, available: 2048 * MIB, contended: false };
  const lock = jest.fn(async (_key, callback) => {
    if (control.contended) return false;
    await callback({}); return true;
  });
  const admission = discoveryAdmissionFixture({ withSessionAdvisoryLock: lock,
    readMemory: () => ({ available: control.available, constrained: 2048 * MIB, total: 16_384 * MIB }) });
  const dependencies = { now: () => control.time,
    readState: jest.fn(async () => ({ ...fixture.state })),
    repository: { read: jest.fn(async () => structuredClone(fixture.snapshot)) },
    createEmbedder: jest.fn(() => ({ ...fixture.identity, inspect: async () => ({ ...fixture.identity }) })),
    fit: jest.fn(async (snapshot, dimensions, options) => buildInventoryRepresentativeProfile({ snapshot, dimensions }, options)),
    withAdmission: jest.fn(admission) };
  return { ...fixture, control, lock, dependencies, worker: createInventoryRepresentativeProfileRefresh(dependencies) };
}

test.each(['memory_pressure', 'memory_unknown', 'busy'])('repeated %s deferrals remain bounded without exponential failure debt', async reason => {
  const v = setup();
  if (reason === 'busy') v.control.contended = true;
  else v.control.available = reason === 'memory_unknown' ? NaN : 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    v.control.time = attempt * 60_000;
    expect(await v.worker.run()).toMatchObject({ status: 'deferred', reason });
    v.control.time += 59_999;
    expect(await v.worker.run()).toMatchObject({ status: 'cooldown' });
    expect(v.dependencies.withAdmission).toHaveBeenCalledTimes(attempt + 1);
  }
  expect(v.dependencies.createEmbedder).not.toHaveBeenCalled();
  expect(v.dependencies.repository.read).not.toHaveBeenCalled();
  expect(v.dependencies.fit).not.toHaveBeenCalled();
  v.control.available = 2048 * MIB; v.control.contended = false; v.control.time = 240_001;
  expect(await v.worker.run()).toMatchObject({ status: 'published' });
  expect(v.dependencies.fit).toHaveBeenCalledTimes(1);
  v.worker.stop();
});

test('resource retries retain the real admission hysteresis and require fresh headroom', async () => {
  const v = setup(); v.control.available = 1024 * MIB - 1;
  expect((await v.worker.run()).status).toBe('deferred');
  v.control.time = 60_000; v.control.available = 1024 * MIB;
  expect(await v.worker.run()).toMatchObject({ status: 'deferred', reason: 'memory_pressure' });
  v.control.time = 120_000; v.control.available = 1088 * MIB;
  expect((await v.worker.run()).status).toBe('published');
  v.worker.stop();
});

test('resource deferrals neither increment nor reset genuine fitting failure history', async () => {
  const v = setup();
  v.dependencies.fit.mockRejectedValueOnce(new Error('PRIVATE failure one'))
    .mockRejectedValueOnce(new Error('PRIVATE failure two'))
    .mockRejectedValueOnce(new Error('PRIVATE failure three'));
  expect((await v.worker.run()).status).toBe('failed');
  v.control.time = 60_000; expect((await v.worker.run()).status).toBe('failed');
  v.control.time = 179_999; expect((await v.worker.run()).status).toBe('cooldown');
  v.control.time = 180_000; v.control.available = 0;
  expect((await v.worker.run()).status).toBe('deferred');
  v.control.time = 240_000; v.control.available = 2048 * MIB;
  expect((await v.worker.run()).status).toBe('failed');
  v.control.time = 479_999; expect((await v.worker.run()).status).toBe('cooldown');
  v.control.time = 480_000; expect((await v.worker.run()).status).toBe('published');
  expect(JSON.stringify(v.worker.getStatus())).not.toContain('PRIVATE');
  v.control.time += 300_000;
  v.dependencies.fit.mockRejectedValueOnce(new Error('unused cached fit'));
  // New configuration discards the old cached fit and resets prior retry history.
  v.state.embedding_model = 'changed';
  expect((await v.worker.run()).status).toBe('failed');
  v.control.time += 60_000; expect((await v.worker.run()).status).toBe('published');
  v.worker.stop();
});

test('readiness pauses preserve failure history and a late tick makes only one attempt', async () => {
  const v = setup(); let readiness = 'ready';
  const worker = withInventoryBackgroundReadiness(v.worker, {}, async () => readiness);
  v.dependencies.fit.mockRejectedValueOnce(new Error('first')).mockRejectedValueOnce(new Error('second'));
  expect((await worker.run()).status).toBe('failed');
  readiness = 'backfilling'; v.control.time = 600_000;
  expect(await worker.run()).toEqual({ status: 'deferred', reason: 'backfilling' });
  expect(v.dependencies.withAdmission).toHaveBeenCalledTimes(1);
  readiness = 'ready'; expect((await worker.run()).status).toBe('failed');
  v.control.time += 60_000; expect((await worker.run()).status).toBe('cooldown');
  v.control.time += 60_000; expect((await worker.run()).status).toBe('published');
  expect(v.dependencies.withAdmission).toHaveBeenCalledTimes(3);
  worker.stop();
});

test('lookalike errors do not bypass failure backoff; only typed admission errors defer', async () => {
  const v = setup();
  v.dependencies.withAdmission.mockRejectedValue(Object.assign(new Error('PRIVATE'), { reason: 'memory_pressure' }));
  expect((await v.worker.run()).status).toBe('failed');
  v.control.time = 60_000; expect((await v.worker.run()).status).toBe('failed');
  v.control.time = 120_000; expect((await v.worker.run()).status).toBe('cooldown');
  v.dependencies.withAdmission.mockRejectedValue(new DiscoveryDeferredError('memory_unknown'));
  v.control.time = 180_000; expect((await v.worker.run()).status).toBe('deferred');
  v.control.time = 240_000; expect((await v.worker.run()).status).toBe('deferred');
  v.worker.stop();
});

test('pressure at the publication checkpoint clears staged results and recovers on a later admitted attempt', async () => {
  const v = setup(), commit = jest.fn();
  let pressure = true;
  const worker = createInventoryRepresentativeProfileRefresh({ ...v.dependencies,
    observer: { hasPending: () => false,
      prepare: () => { if (pressure) v.control.available = 0; return { commit }; }, stop() {} } });
  expect(await worker.run()).toMatchObject({ status: 'deferred', reason: 'memory_pressure' });
  expect(commit).not.toHaveBeenCalled(); expect(worker.getStatus().cacheStored).toBe(false);
  v.control.time = 60_000; v.control.available = 2048 * MIB;
  expect(await worker.run()).toMatchObject({ status: 'deferred', reason: 'memory_pressure' });
  expect(commit).not.toHaveBeenCalled();
  v.control.time = 120_000; v.control.available = 2048 * MIB; pressure = false;
  expect((await worker.run()).status).toBe('published');
  expect(commit).toHaveBeenCalledTimes(1);
  worker.stop(); v.worker.stop();
});

test('the unchanged schedule tolerates just-early and delayed ticks without early retries or catch-up bursts', async () => {
  const v = setup(), scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerInventoryRepresentativeProfileSchedule(scheduler, { worker: v.worker, log: { info() {} } });
  const [name, expression, tick, , options] = scheduler.schedule.mock.calls[0];
  expect(expression).toBe('30 * * * * *'); expect(options).toEqual({ noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith(name, 90_000, expect.any(Function));
  v.control.available = 0; v.control.time = 90_001;
  expect((await scheduler.scheduleInitial.mock.calls[0][2]()).status).toBe('deferred');
  v.control.time = 150_000; expect((await tick()).status).toBe('cooldown');
  v.control.time = 210_002; expect((await tick()).status).toBe('deferred');
  v.control.time = 900_000; v.control.available = 2048 * MIB;
  expect((await tick()).status).toBe('published');
  expect(v.dependencies.withAdmission).toHaveBeenCalledTimes(3);
  expect(v.dependencies.fit).toHaveBeenCalledTimes(1);
  scheduler.inventoryRepresentativeProfileWorker.stop();
});

test('cancellation preserves prior failure history and stop prevents future admission', async () => {
  const v = setup();
  v.dependencies.fit.mockRejectedValueOnce(new Error('first')).mockRejectedValueOnce(new Error('second'));
  expect((await v.worker.run()).status).toBe('failed');
  const cancelled = new AbortController(); cancelled.abort(); v.control.time = 60_000;
  expect((await v.worker.run({ signal: cancelled.signal })).status).toBe('cancelled');
  expect((await v.worker.run()).status).toBe('failed');
  v.control.time = 120_000; expect((await v.worker.run()).status).toBe('cooldown');
  v.worker.stop(); v.control.time = 10_000_000;
  expect((await v.worker.run()).status).toBe('cancelled');
  expect(v.dependencies.withAdmission).toHaveBeenCalledTimes(2);
});
