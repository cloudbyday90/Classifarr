/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createEmbeddedProbeTrace, observeProbe, supervisorProbeResources } from '../bootstrap/embeddedProbeDiagnostics.mjs';
import { probeEmbeddedDatabase } from '../bootstrap/embeddedDatabaseProbe.mjs';
import { createEmbeddedDatabaseControl } from '../bootstrap/embeddedDatabaseControl.mjs';
import { runEmbeddedDatabaseStatusProbe } from '../bootstrap/embeddedDatabaseStatusProbe.mjs';
import { watchEmbeddedDatabase } from '../bootstrap/embeddedDatabaseMonitor.mjs';

afterEach(() => jest.useRealTimers());
const trace = () => createEmbeddedProbeTrace({ timeoutMs: 3000, sequence: 1, now: () => performance.now() });

test('stage timing retains timeout location after subsequent identity validation', () => {
  let time = 0;
  const t = createEmbeddedProbeTrace({ timeoutMs: 3000, sequence: 4, now: () => time,
    cpu: previous => previous ? { user: 100, system: 50 } : { user: 10, system: 5 },
    elu: previous => previous ? { utilization: 0.25 } : { active: 1, idle: 1, utilization: 0.5 } });
  t.observe('identity_before'); time = 20; t.observe('status_spawn');
  time = 25; t.observe('status_wait'); time = 2050; t.observe('helper_timeout');
  t.observe('identity_after'); time = 2060;
  t.observe('outcome', { state: 'transient', joined: true, secret: 'DO_NOT_LOG' });
  expect(t.snapshot()).toMatchObject({ sequence: 4, elapsedMs: 2060, lastStage: 'identity_after',
    stages: { identity_before: 20, status_spawn: 5, status_wait: 2025, identity_after: 10 },
    helperTimeout: { stage: 'status_wait', elapsedMs: 2030, overshootMs: 30 },
    supervisorCpuUserMicros: 100, supervisorCpuSystemMicros: 50, supervisorEluPermille: 250 });
  for (let i = 0; i < 1000; i++) t.observe(`private-${i}`, 'DO_NOT_LOG');
  t.observe('identity_before');
  expect(JSON.stringify(t.snapshot())).not.toMatch(/DO_NOT_LOG|private/);
  expect(Object.keys(t.snapshot().stages)).toHaveLength(5);
});

test.each(['identity_before', 'identity_after'])('real control attributes a stuck %s read and joins cancellation', async stage => {
  jest.useFakeTimers();
  const read = jest.fn(async () => '123\n/app/data/postgres\n1790000000\n5432\n');
  const db = createEmbeddedDatabaseControl({ read, status: async () => {} });
  await db.adopt();
  if (stage === 'identity_after') read.mockResolvedValueOnce('123\n/app/data/postgres\n1790000000\n5432\n');
  read.mockImplementationOnce(({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const t = trace();
  const pending = probeEmbeddedDatabase(options => db.check(options), { observe: t.observe });
  await jest.advanceTimersByTimeAsync(3000);
  expect(await pending).toEqual({ state: 'transient', reason: 'database_probe_timeout', joined: true });
  expect(t.snapshot()).toMatchObject({ state: 'transient', joined: true, deadline: { stage, elapsedMs: 3000, overshootMs: 0 }, joinElapsedMs: 0 });
  expect(jest.getTimerCount()).toBe(0);
});

test('real status adapter separates child spawn from wait and marks its deadline', async () => {
  jest.useFakeTimers();
  const child = Object.assign(new EventEmitter(), { pid: 123, kill: jest.fn(() => child.emit('exit', null, 'SIGKILL')) });
  const t = trace();
  const pending = probeEmbeddedDatabase(options => runEmbeddedDatabaseStatusProbe({ ...options, spawnFn: () => child }), { observe: t.observe });
  await jest.advanceTimersByTimeAsync(10); child.emit('spawn');
  await jest.advanceTimersByTimeAsync(1990);
  expect(await pending).toMatchObject({ state: 'transient', joined: true });
  expect(t.snapshot()).toMatchObject({ helperTimeout: { stage: 'status_wait', elapsedMs: 2000, overshootMs: 0 }, stages: { status_spawn: 10 } });
  expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  expect(jest.getTimerCount()).toBe(0);
});

test('late success records scheduling overshoot without becoming recovery', async () => {
  let time = 0;
  const t = createEmbeddedProbeTrace({ timeoutMs: 3000, sequence: 1, now: () => time });
  const result = await probeEmbeddedDatabase(async ({ observe }) => { observe('identity_before'); time = 4000; }, { now: () => time, observe: t.observe });
  expect(result.state).toBe('transient');
  expect(t.snapshot()).toMatchObject({ deadline: { stage: 'identity_before', overshootMs: 1000 }, joined: true });
});

test('unjoined check records the join budget and freezes late callbacks', async () => {
  jest.useFakeTimers();
  const t = trace();
  const pending = probeEmbeddedDatabase(({ observe }) => { observe('identity_before'); return new Promise(() => {}); }, { observe: t.observe });
  await jest.advanceTimersByTimeAsync(4000);
  expect(await pending).toEqual({ state: 'unjoined', joined: false });
  expect(t.snapshot()).toMatchObject({ joined: false, joinElapsedMs: 1000, elapsedMs: 4000 });
  t.observe('complete'); expect(t.snapshot().lastStage).toBe('identity_before');
});

test('unknown failures and unavailable metrics never expose raw errors', async () => {
  const t = createEmbeddedProbeTrace({ timeoutMs: 3000, sequence: 1,
    cpu: () => { throw new Error('CPU_SECRET'); }, elu: () => { throw new Error('ELU_SECRET'); } });
  const result = await probeEmbeddedDatabase(async () => { throw new Error('PAYLOAD_SECRET'); }, { observe: t.observe });
  expect(result).toEqual({ state: 'failed', joined: true });
  expect(t.snapshot()).toMatchObject({ supervisorCpuUserMicros: null, supervisorEluPermille: null });
  expect(JSON.stringify(t.snapshot())).not.toContain('SECRET');
  expect(() => observeProbe(() => { throw new Error('sink'); }, 'deadline')).not.toThrow();
  expect(supervisorProbeResources()).toMatchObject({ scope: 'supervisor' });
});

test('throwing observer cannot change control, helper or probe success', async () => {
  const observe = () => { throw new Error('broken sink'); };
  const db = createEmbeddedDatabaseControl({ read: async () => '123\n/app/data/postgres\n1790000000\n', status: async () => {} });
  await db.adopt();
  expect(await probeEmbeddedDatabase(options => db.check(options), { observe })).toEqual({ state: 'ok', joined: true });
  const child = Object.assign(new EventEmitter(), { pid: 123, kill: jest.fn() });
  const status = runEmbeddedDatabaseStatusProbe({ observe, spawnFn: () => child });
  child.emit('spawn'); child.emit('exit', 0, null); await status;
});

test('healthy reference, fresh episode IDs, first failure retention and quiet healthy probes', async () => {
  const abort = new AbortController(), records = [];
  let time = 0, calls = 0;
  await watchEmbeddedDatabase({ database: {}, signal: abort.signal, requestStop: jest.fn(), now: () => time,
    delay: async ms => { time += ms; },
    probe: async () => {
      calls++;
      if (calls === 6) abort.abort();
      return { state: [2, 4, 5].includes(calls) ? 'transient' : 'ok', reason: 'database_probe_timeout', joined: true };
    }, report: (...args) => { if (args[0] === 'database_probe_diagnostic') records.push(args); } });
  expect(records.map(([, phase]) => phase)).toEqual(['waiting', 'recovered', 'waiting', 'cancelled']);
  expect(records[0][2].lastHealthy.sequence).toBe(1);
  expect(records[2][2].lastHealthy.sequence).toBe(3);
  expect(records[0][2].episodeId).not.toBe(records[2][2].episodeId);
  expect(records[3][2]).toMatchObject({ firstFailure: { sequence: 4 }, latest: { sequence: 6 } });
  expect(JSON.stringify(records[3]).length).toBeLessThan(6000);
});
