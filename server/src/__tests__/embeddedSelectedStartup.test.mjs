/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runSelectedEmbeddedStartup } from '../bootstrap/embeddedSelectedStartup.mjs';

const tick = () => new Promise(resolve => { setImmediate(resolve); });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  const events = [], binding = 'a'.repeat(64), processRef = new EventEmitter();
  const job = deferred(), runtime = deferred();
  const journal = { read: jest.fn(async () => ({ version: 1, binding, completed: 5, pending: null })),
    selection: { read: jest.fn(async () => null), write: jest.fn(async value => { events.push(value.phase); }) } };
  const database = { adopt: jest.fn(async () => { events.push('adopt'); }), check: jest.fn(),
    stop: jest.fn(async () => { events.push('stop'); }) };
  const options = { journal, binding, database, processRef,
    verify: jest.fn(async () => { events.push('verify'); }),
    startMaintenance: jest.fn(() => { events.push('maintenance'); return { done: job.promise,
      signal: jest.fn(() => job.resolve({ code: null, signal: 'SIGTERM' })) }; }),
    startApplication: jest.fn(() => { events.push('runtime'); return { done: runtime.promise,
      signal: jest.fn(() => runtime.resolve({ code: 0, signal: null })) }; }),
  };
  return { events, job, runtime, journal, database, processRef, options };
}

test('selection, adoption, maintenance, runtime and drain remain within the caller lifecycle', async () => {
  const f = fixture();
  const run = runSelectedEmbeddedStartup(f.options);
  await tick();
  expect(f.events).toEqual(['verifying', 'verify', 'selected', 'adopt', 'maintenance']);
  f.job.resolve({ code: 0, signal: null }); await tick();
  expect(f.events.at(-1)).toBe('runtime');
  f.processRef.emit('SIGTERM');
  expect(await run).toBe(0);
  expect(f.events.at(-1)).toBe('stop');
  expect(f.processRef.eventNames()).toEqual([]);
});

test.each(['empty', 'incomplete', 'wrong_binding', 'malformed_selection', 'verification', 'durability'])('rejects %s before database startup', async failure => {
  const f = fixture();
  if (failure === 'empty') f.journal.read.mockResolvedValue(null);
  if (failure === 'incomplete') f.journal.read.mockResolvedValue({ version: 1, binding: f.options.binding, completed: 4, pending: null });
  if (failure === 'wrong_binding') f.options.binding = 'b'.repeat(64);
  if (failure === 'malformed_selection') f.journal.selection.read.mockResolvedValue({ path: '/old' });
  if (failure === 'verification') f.options.verify.mockRejectedValue(new Error('unsafe'));
  if (failure === 'durability') f.journal.selection.write.mockRejectedValue(new Error('sync'));
  expect(await runSelectedEmbeddedStartup(f.options)).toBe(1);
  expect(f.database.adopt).not.toHaveBeenCalled();
  expect(f.database.stop).not.toHaveBeenCalled();
  expect(f.options.startMaintenance).not.toHaveBeenCalled();
  expect(f.options.startApplication).not.toHaveBeenCalled();
});

test.each(['verification', 'selection'])('host signal during %s cannot launch the database', async phase => {
  const f = fixture(), pending = deferred();
  if (phase === 'verification') f.options.verify.mockImplementation(async ({ signal }) => {
    await pending.promise; expect(signal.aborted).toBe(true);
  });
  else f.journal.selection.write.mockImplementation(async value => { if (value.phase === 'selected') await pending.promise; });
  const run = runSelectedEmbeddedStartup(f.options);
  await tick(); f.processRef.emit('SIGTERM'); pending.resolve();
  expect(await run).toBe(1);
  expect(f.database.adopt).not.toHaveBeenCalled();
  expect(f.options.startApplication).not.toHaveBeenCalled();
  expect(f.processRef.eventNames()).toEqual([]);
});

test('an existing selection still verifies before adopting', async () => {
  const f = fixture();
  f.journal.selection.read.mockResolvedValue({ version: 1, binding: f.options.binding, phase: 'selected' });
  f.database.adopt.mockRejectedValue(new Error('adapter_cleaned_failed_start'));
  expect(await runSelectedEmbeddedStartup(f.options)).toBe(1);
  expect(f.events).toEqual(['verify', 'selected']);
  expect(f.options.startMaintenance).not.toHaveBeenCalled();
  expect(f.database.stop).not.toHaveBeenCalled();
});

test('failed maintenance never launches runtime but stops the adopted candidate', async () => {
  const f = fixture(); f.job.resolve({ code: 1, signal: null });
  expect(await runSelectedEmbeddedStartup(f.options)).toBe(1);
  expect(f.options.startApplication).not.toHaveBeenCalled();
  expect(f.database.stop).toHaveBeenCalledTimes(1);
});

test('cancellation during maintenance joins it and stops the candidate without runtime', async () => {
  const f = fixture();
  const run = runSelectedEmbeddedStartup(f.options);
  await tick(); f.processRef.emit('SIGINT');
  expect(await run).toBe(0);
  expect(f.database.stop).toHaveBeenCalledTimes(1);
  expect(f.options.startApplication).not.toHaveBeenCalled();
});

test('cancellation during adoption waits for the adapter and then cleans the adopted database', async () => {
  const f = fixture(), adopted = deferred();
  f.database.adopt.mockImplementation(async ({ signal }) => {
    await adopted.promise; expect(signal.aborted).toBe(true);
  });
  const run = runSelectedEmbeddedStartup(f.options);
  await tick(); f.processRef.emit('SIGTERM'); adopted.resolve();
  expect(await run).toBe(0);
  expect(f.database.stop).toHaveBeenCalledTimes(1);
  expect(f.options.startMaintenance).not.toHaveBeenCalled();
});

test('the caller cannot finish its lease scope before database shutdown is joined', async () => {
  const f = fixture(), stopped = deferred();
  f.job.resolve({ code: 0, signal: null }); f.runtime.resolve({ code: 0, signal: null });
  f.database.stop.mockReturnValue(stopped.promise);
  let released = false;
  const run = runSelectedEmbeddedStartup(f.options).finally(() => { released = true; });
  await tick();
  expect(f.database.stop).toHaveBeenCalledTimes(1);
  expect(released).toBe(false);
  stopped.resolve(); expect(await run).toBe(0); expect(released).toBe(true);
});

test.each(['verify', 'startMaintenance', 'startApplication', 'database'])('requires %s before selection effects', async key => {
  const f = fixture();
  await expect(runSelectedEmbeddedStartup({ ...f.options, [key]: null })).rejects.toThrow('composition_invalid');
  expect(f.journal.read).not.toHaveBeenCalled();
});
