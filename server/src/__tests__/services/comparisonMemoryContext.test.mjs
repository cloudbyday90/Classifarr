/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLiveMultiScaleRefresh } from '../../services/liveMultiScaleRefresh.mjs';
import { createInventoryDiscoveryAdmission } from '../../services/inventoryDiscoveryAdmission.mjs';
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';
import { createComparisonMemoryEvidence } from '../../services/comparisonMemoryEvidence.mjs';
import { describeLiveMultiScaleRetry } from '../../services/liveMultiScaleDiagnostics.mjs';
import { registerLiveMultiScaleSchedule } from '../../services/liveMultiScaleScheduler.mjs';
import { inspectUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { liveFixture } from '../fixtures/liveMultiScaleFixture.mjs';

const MIB = 1024 * 1024;
function setup(extra = {}) {
  let available = 0, now = 1000000;
  const fixture = liveFixture();
  const readMemory = () => ({ available, constrained: 2048 * MIB, total: 16384 * MIB });
  const resourceAdmission = createBackgroundResourceAdmission({ readMemory });
  const withAdmission = createInventoryDiscoveryAdmission({ resourceAdmission, readMemory,
    withSessionAdvisoryLock: async (_key, callback) => { await callback({}); return true; } });
  const repository = { read: jest.fn(async () => fixture.snapshot),
    readVerification: jest.fn(async () => ({ ...fixture.snapshot, vectors: undefined,
      key: inspectUnseenMultiScaleSource(fixture.snapshot, fixture.identity).key })) };
  const build = jest.fn(async () => ({ cacheable: true, weight: 1000, handle: { retrieve: async () => null } }));
  const worker = createLiveMultiScaleRefresh({ repository, build, withAdmission, now: () => now, random: () => 0,
    readState: async () => fixture.state, createEmbedder: () => ({ ...fixture.identity, inspect: async () => fixture.identity }),
    memoryEvidence: createComparisonMemoryEvidence({ readMemory, now: () => now,
      readUsage: () => ({ rss: 100 * MIB, heapUsed: 50 * MIB }) }), ...extra });
  return { worker, repository, resourceAdmission, build, set: bytes => { available = bytes; }, advance: () => { now += 300000; } };
}

test('real admission preserves exact budget and hysteresis through refresh and sanitized warning', async () => {
  const v = setup();
  const first = await v.worker.run(), diagnostic = describeLiveMultiScaleRetry(first);
  expect(diagnostic.memory.decision).toMatchObject({ phase: 'shared_admission', stage: 'admission',
    availableBytes: 0, constrainedBytes: 2048 * MIB, effectiveLimitBytes: 2048 * MIB,
    requiredBytes: 1024 * MIB, reserveBytes: 256 * MIB,
    reservedBytes: 0, workBytes: 768 * MIB, hysteresisBytes: 0, active: { ingestion: 0, queue: 0, discovery: 0 } });
  expect(v.repository.read).not.toHaveBeenCalled();
  expect(await v.worker.run()).toEqual({ status: 'not_due' });
  v.advance(); v.set(1024 * MIB);
  const second = await v.worker.run();
  expect(second.memory.decision).toMatchObject({ requiredBytes: 1088 * MIB, hysteresisBytes: 64 * MIB });
  expect(second.memory.reference).toBe(first.memory.reference);
  v.advance(); v.set(2048 * MIB);
  const recovered = await v.worker.run();
  expect(recovered.status).toBe('ready'); expect(recovered.memory.reference).toBe(first.memory.reference);
  expect(recovered.memory.end.cache.entries).toBe(1);
  v.worker.stop();
});

test('running checkpoint records failing stage before cleanup and retains no cache', async () => {
  const v = setup(); v.set(2048 * MIB);
  // Explicit checkpoint after the build detects the new pressure at publication.
  v.build.mockImplementation(async () => { v.set(0); return { cacheable: true, weight: 1000, handle: {} }; });
  const result = await v.worker.run();
  expect(result).toMatchObject({ status: 'deferred', reason: 'memory_pressure', memory: {
    decision: { phase: 'running_checkpoint', stage: 'publication', requiredBytes: 256 * MIB, availableBytes: 0 },
    end: { cache: { entries: 0, estimatedBytes: 0 } },
    source: { libraries: expect.any(Number), documents: expect.any(Number), vectors: expect.any(Number), dimensions: 4 },
  } });
  v.set(2048 * MIB); const permit = v.resourceAdmission.tryAcquire('discovery');
  expect(permit.allowed).toBe(true); permit.release(); v.worker.stop();
});

test('scheduler deduplication ignores changing evidence IDs and correlates recovery', async () => {
  const v = setup(), scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  const log = { info: jest.fn(), warn: jest.fn() };
  registerLiveMultiScaleSchedule(scheduler, { worker: v.worker, log });
  const run = scheduler.schedule.mock.calls[0][2];
  await run(); const warning = log.warn.mock.calls[0][1];
  v.advance(); await run(); expect(log.warn).toHaveBeenCalledTimes(1);
  v.advance(); v.set(2048 * MIB); await run();
  expect(log.info).toHaveBeenCalledWith('Library comparison context recovered automatically', {
    memory: expect.objectContaining({ reference: warning.memory.reference, attempts: 3 }),
  });
  scheduler.liveMultiScaleWorker.stop();
});

test.each(['begin', 'observe'])('broken %s telemetry cannot change the refresh result or serving lifecycle', async boundary => {
  const fail = () => { throw new Error('PRIVATE'); };
  const memoryEvidence = boundary === 'begin' ? { begin: fail }
    : { begin: () => ({ stage: fail, source: fail, decision: fail, finish: fail }) };
  const v = setup({ memoryEvidence }); v.set(2048 * MIB);
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  v.advance(); v.set(0);
  expect(await v.worker.run()).toEqual({ status: 'deferred', reason: 'memory_pressure' });
  v.set(2048 * MIB); v.advance();
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  v.worker.stop();
});

test('not-due attempts perform no extra measurements', async () => {
  const evidence = createComparisonMemoryEvidence(), begin = jest.spyOn(evidence, 'begin');
  const v = setup({ memoryEvidence: evidence });
  await v.worker.run(); expect(begin).toHaveBeenCalledTimes(1);
  expect(await v.worker.run()).toEqual({ status: 'not_due' });
  expect(begin).toHaveBeenCalledTimes(1); v.worker.stop();
});
