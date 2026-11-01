/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLogPersistenceFallback } from '../../utils/logging/persistenceFallback.mjs';

const MESSAGE = 'Classifarr log persistence unavailable; check logging and database health.';

test('first output at time zero and exact sixty-second boundaries are independent of call volume', () => {
  let time = 0;
  const emit = jest.fn(), report = createLogPersistenceFallback({ clock: () => time, emit });
  report(); expect(emit.mock.calls).toEqual([[MESSAGE]]);
  for (let attempt = 0; attempt < 1000; attempt++) { time = attempt * 50; report(); }
  time = 59_999.9; report(); expect(emit).toHaveBeenCalledTimes(1);
  time = 60_000; report(); expect(emit).toHaveBeenCalledTimes(2);
  time = 119_999.9; report(); expect(emit).toHaveBeenCalledTimes(2);
  time = 120_000; report(); expect(emit).toHaveBeenCalledTimes(3);
  createLogPersistenceFallback({ clock: () => time, emit })();
  expect(emit).toHaveBeenCalledTimes(4); // A fresh reporter has no persisted interval.
});

test('reentrant output cannot bypass the interval consumed before emission', () => {
  let time = 0, report;
  const emit = jest.fn(() => { report(); });
  report = createLogPersistenceFallback({ clock: () => time, emit });
  report(); expect(emit).toHaveBeenCalledTimes(1);
  time = 60_000; report(); expect(emit).toHaveBeenCalledTimes(2);
});

test.each(['throw', 'reject', 'then_getter'])('%s output failure is swallowed and still consumes the interval', async mode => {
  let time = 0;
  const emit = jest.fn(() => {
    if (mode === 'throw') throw Error('PRIVATE sink');
    if (mode === 'reject') return Promise.reject(Error('PRIVATE sink'));
    return { get then() { throw Error('PRIVATE sink getter'); } };
  });
  const report = createLogPersistenceFallback({ clock: () => time, emit });
  expect(() => report()).not.toThrow();
  report(); await Promise.resolve();
  expect(emit.mock.calls).toEqual([[MESSAGE]]);
  time = 60_000; expect(() => report()).not.toThrow(); await Promise.resolve();
  expect(emit.mock.calls).toEqual([[MESSAGE], [MESSAGE]]);
});

test('invalid, throwing and reversed clocks suppress without coercion or erasing the bound', () => {
  let time;
  const coerce = jest.fn(() => { throw Error('PRIVATE coercion'); });
  const emit = jest.fn(), report = createLogPersistenceFallback({ clock: () => {
    if (time === 'throw') throw Error('PRIVATE clock');
    return time;
  }, emit });
  for (time of [NaN, Infinity, -Infinity, -1, null, undefined, '0', 60_000n, Symbol('clock'), { valueOf: coerce }, 'throw']) report();
  expect(emit).not.toHaveBeenCalled(); expect(coerce).not.toHaveBeenCalled();
  time = 0; report();
  time = NaN; report();
  time = 59_999; report(); expect(emit).toHaveBeenCalledTimes(1);
  time = 60_000; report();
  time = 1; report();
  time = 119_999; report(); expect(emit).toHaveBeenCalledTimes(2);
  time = 120_000; report(); expect(emit).toHaveBeenCalledTimes(3);
});

test('default process clock does not consult wall-clock time', () => {
  const emit = jest.fn(), wall = jest.spyOn(Date, 'now').mockImplementation(() => { throw Error('wall clock unavailable'); });
  let reads;
  try {
    const report = createLogPersistenceFallback({ emit });
    report(); report(); reads = wall.mock.calls.length;
  } finally { wall.mockRestore(); }
  expect(reads).toBe(0); expect(emit.mock.calls).toEqual([[MESSAGE]]);
});

test('caller arguments are ignored without touching hostile payloads', () => {
  const inspect = jest.fn(() => { throw Error('PRIVATE inspection'); });
  const payload = new Proxy({}, { get: inspect, ownKeys: inspect, getOwnPropertyDescriptor: inspect });
  const emit = jest.fn(), report = createLogPersistenceFallback({ clock: () => 0, emit });
  report(payload);
  expect(inspect).not.toHaveBeenCalled(); expect(emit.mock.calls).toEqual([[MESSAGE]]);
});
