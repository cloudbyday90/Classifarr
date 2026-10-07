/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { constants } from 'node:perf_hooks';
import { observeNaturalMajorGc, POST_STOP_GC_WAIT_MS } from '../../scripts/comparisonMemoryStudy/naturalMajorGc.mjs';
import { assertPostStopGcReceipt, projectPostStopSample } from '../../scripts/comparisonMemoryStudy/postStopGcContract.mjs';

function harness() {
  let callback, tick, time = 100, queued = [];
  const disconnect = jest.fn(), observe = jest.fn(), clearTimer = jest.fn(), nextTurn = jest.fn(async () => {});
  class Observer {
    constructor(fn) { callback = fn; }
    observe = observe;
    disconnect = disconnect;
    takeRecords() { return queued; }
  }
  const options = { Observer, now: () => time, nextTurn, clearTimer,
    setTimer: jest.fn(fn => { tick = fn; return 42; }), mainThread: true };
  return { options, observe, disconnect, clearTimer,
    send: entries => callback({ getEntries: () => entries }),
    expire: entries => { queued = entries ?? []; time = 100 + POST_STOP_GC_WAIT_MS; tick(); },
    advance: value => { time = value; } };
}
const major = (startTime = 101, duration = 2, flags = 0) => ({ entryType: 'gc', startTime, duration,
  detail: { kind: constants.NODE_PERFORMANCE_GC_MAJOR, flags } });

test('yields before observing; ignores other entries and old events; stores only fixed numeric fields', async () => {
  const h = harness(), pending = observeNaturalMajorGc(h.options);
  expect(h.observe).not.toHaveBeenCalled(); await Promise.resolve();
  expect(h.observe).toHaveBeenCalledWith({ entryTypes: ['gc'] });
  expect(h.options.setTimer).toHaveBeenCalledWith(expect.any(Function), 300_000);
  h.advance(200);
  h.send([{ ...major(), entryType: 'mark' }, { ...major(), detail: { kind: constants.NODE_PERFORMANCE_GC_MINOR } }, major(99, 100)]);
  expect(h.disconnect).not.toHaveBeenCalled();
  h.send([{ ...major(), secret: 'private', name: 'payload' }]);
  expect(await pending).toEqual({ status: 'observed', scope: 'main_thread_major_gc_event', windowStartMs: 100,
    windowEndMs: 200, waitBudgetMs: 300_000, event: { startMs: 101, durationMs: 2, kind: 4, flags: 0 } });
  h.send([major()]);
  expect(h.disconnect).toHaveBeenCalledTimes(1); expect(h.clearTimer).toHaveBeenCalledWith(42);
});

test('an idle timeout is inconclusive, never a made-up collection', async () => {
  const h = harness(), pending = observeNaturalMajorGc(h.options); await Promise.resolve();
  h.expire();
  expect(await pending).toMatchObject({ status: 'not_observed', event: null, windowEndMs: 300_100 });
  expect(h.disconnect).toHaveBeenCalledTimes(1);
});

test('drains already queued in-window events at timeout but excludes events beyond its deadline', async () => {
  for (const [entry, status] of [[major(300_099, 1), 'observed'], [major(300_099, 2), 'not_observed']]) {
    const h = harness(), pending = observeNaturalMajorGc(h.options); await Promise.resolve();
    h.expire([entry]); expect((await pending).status).toBe(status);
    expect(h.disconnect).toHaveBeenCalledTimes(1);
  }
});

test.each([
  major(101, 2, constants.NODE_PERFORMANCE_GC_FLAGS_FORCED | 32), major(101, 2, -1),
  major(101, 2, NaN), major(101, 2, 128), major(101, 2, 1), major(NaN), major(101, -1), major(190, 11),
])('invalid or forced evidence rejects and releases observer/timer (%#)', async entry => {
  const h = harness(), pending = observeNaturalMajorGc(h.options); await Promise.resolve(); h.advance(200);
  h.send([entry]); await expect(pending).rejects.toThrow();
  expect(h.disconnect).toHaveBeenCalledTimes(1); expect(h.clearTimer).toHaveBeenCalledWith(42);
});

test('scheduled idle collection is natural, not confused with the forced flag', async () => {
  const h = harness(), pending = observeNaturalMajorGc(h.options); await Promise.resolve(); h.advance(200);
  h.send([major(101, 2, constants.NODE_PERFORMANCE_GC_FLAGS_SCHEDULE_IDLE)]);
  expect((await pending).event.flags).toBe(64);
});

test('subscription failure cleans up, and worker-isolate use is refused before subscribing', async () => {
  const h = harness(); h.observe.mockImplementation(() => { throw new Error('subscribe_failed'); });
  await expect(observeNaturalMajorGc(h.options)).rejects.toThrow('subscribe_failed');
  expect(h.disconnect).toHaveBeenCalledTimes(1);
  await expect(observeNaturalMajorGc({ ...h.options, mainThread: false })).rejects.toThrow('comparison_gc_main_thread_required');
  expect(h.observe).toHaveBeenCalledTimes(1);
});

function receipt(status = 'observed') {
  const before = projectPostStopSample({ elapsedMs: 1000, heapUsed: 10, heapTotal: 20, rss: 30, external: 4,
    arrayBuffers: 2, containerBytes: 40, createdWorkers: 2, exitedWorkers: 2, activeWorkers: 0,
    diagnosticGc: false, alive: { comparisonHandle: 1 }, secret: 'private' });
  return { version: 1, status, scope: 'main_thread_major_gc_event', windowStartMs: 1100,
    windowEndMs: status === 'observed' ? 1200 : 301100, waitBudgetMs: 300000,
    event: status === 'observed' ? { startMs: 1110, durationMs: 2, kind: 4, flags: 0 } : null,
    before, after: { ...structuredClone(before), elapsedMs: status === 'observed' ? 1101 : 301001 } };
}

test.each(['observed', 'not_observed'])('bounded %s receipt does not require observed referents to be collected', status => {
  const row = receipt(status);
  expect(JSON.stringify(row)).not.toContain('private');
  expect(() => assertPostStopGcReceipt(row)).not.toThrow();
  row.after.alive.comparisonHandle = 0; expect(() => assertPostStopGcReceipt(row)).not.toThrow();
});

test.each([
  r => { r.secret = 'private'; }, r => { r.version = 2; }, r => { r.scope = 'worker'; },
  r => { r.waitBudgetMs++; }, r => { r.windowStartMs = NaN; }, r => { r.event.kind = 1; },
  r => { r.event.flags = 4; }, r => { r.event.startMs = 1099; }, r => { r.event.durationMs = 91; },
  r => { r.event.extra = 'private'; }, r => { r.after.activeWorkers = 1; },
  r => { r.before.createdWorkers = 0; }, r => { r.after.exitedWorkers = 1; },
  r => { r.after.createdWorkers = r.after.exitedWorkers = 3; }, r => { r.after.diagnosticGc = true; },
  r => { r.after.elapsedMs = 999; }, r => { r.before.rss = Infinity; },
  r => { r.after.alive.comparisonHandle++; }, r => { r.before.alive.secret = 1; },
  r => { r.before.alive.snapshot = 256; }, r => { r.after.alive.snapshot = -1; },
  r => { r.status = 'not_observed'; }, r => { r.event = null; },
  r => { r.windowEndMs += 400000; },
])('rejects contradictory, unbounded or private evidence (%#)', change => {
  const row = receipt(); change(row); expect(() => assertPostStopGcReceipt(row)).toThrow();
});
