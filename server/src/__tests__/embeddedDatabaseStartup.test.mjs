/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readDatabaseStartupTimeout, runEmbeddedDatabaseStartup } from '../bootstrap/embeddedDatabaseStartup.mjs';

function fixture() {
  let time = 0;
  let exited = false;
  let finish;
  const done = new Promise(resolve => { finish = value => { exited = true; resolve(value); }; });
  const child = { pid: 123, done, hasExited: () => exited,
    signal: jest.fn(() => finish({ code: 0 })), detach: jest.fn() };
  const abort = new AbortController();
  const options = { launch: jest.fn(() => child), probe: jest.fn(async () => ({ ready: false, phase: 'starting_or_recovering' })),
    now: () => time, delay: jest.fn(async ms => { time += ms; }), report: jest.fn(), signal: abort.signal };
  return { child, options, abort, finish, advance: ms => { time += ms; } };
}

test('default and existing timeout settings require no template change', () => {
  expect(readDatabaseStartupTimeout({})).toBe(300_000);
  expect(readDatabaseStartupTimeout({ PGCTLTIMEOUT: '120' })).toBe(120_000);
  expect(readDatabaseStartupTimeout({ PGCTLTIMEOUT: '60', CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: '180' })).toBe(180_000);
});

test.each(['', '0', '-1', '1.5', '1801', 'Infinity', '600; command', ' 300'])('rejects invalid deadline %j', value => {
  expect(() => readDatabaseStartupTimeout({ CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: value })).toThrow('timeout_invalid');
});

test('a database recovering beyond the old sixty-second deadline can become ready without relaunch', async () => {
  const f = fixture();
  f.options.probe.mockImplementation(async () => ({ ready: f.options.now() >= 75_000, phase: 'starting_or_recovering' }));
  await runEmbeddedDatabaseStartup(f.options);
  expect(f.options.launch).toHaveBeenCalledTimes(1);
  expect(f.options.report).toHaveBeenLastCalledWith({ status: 'ready', elapsedSeconds: 75 });
  expect(f.options.report.mock.calls.filter(([event]) => event.status === 'waiting')).toHaveLength(5);
  expect(f.child.signal).not.toHaveBeenCalled();
  expect(f.child.detach).toHaveBeenCalledTimes(1);
});

test('waiting and progress cannot renew the absolute deadline', async () => {
  const f = fixture();
  await expect(runEmbeddedDatabaseStartup({ ...f.options, timeoutMs: 3000 })).rejects.toThrow('timeout');
  expect(f.options.now()).toBe(3000);
  expect(f.child.signal.mock.calls).toEqual([['SIGINT']]);
  expect(f.options.report).toHaveBeenLastCalledWith({ status: 'process_stopped' });
  expect(f.options.launch).toHaveBeenCalledTimes(1);
});

test('late success is rejected instead of declaring readiness after the deadline', async () => {
  const f = fixture();
  f.options.probe.mockImplementation(async () => { f.advance(5000); return { ready: true }; });
  await expect(runEmbeddedDatabaseStartup({ ...f.options, timeoutMs: 3000 })).rejects.toThrow('timeout');
  expect(f.options.report.mock.calls.some(([event]) => event.status === 'ready')).toBe(false);
});

test('a stuck probe has a wall-clock deadline and receives cancellation', async () => {
  const f = fixture();
  let probeSignal;
  f.options.probe.mockImplementation((_pid, signal) => { probeSignal = signal; return new Promise(() => {}); });
  await expect(runEmbeddedDatabaseStartup({ ...f.options, timeoutMs: 20 })).rejects.toThrow('timeout');
  expect(probeSignal.aborted).toBe(true);
  expect(f.child.signal.mock.calls).toEqual([['SIGINT']]);
});

test('host cancellation stops only the launched child and never reports ready', async () => {
  const f = fixture();
  f.options.probe.mockImplementation(async () => { f.abort.abort(); return { ready: true }; });
  await expect(runEmbeddedDatabaseStartup(f.options)).rejects.toThrow('cancelled');
  expect(f.child.signal.mock.calls).toEqual([['SIGINT']]);
});

test('pre-cancelled startup and invalid budgets do not launch a process', async () => {
  const f = fixture();
  f.abort.abort();
  await expect(runEmbeddedDatabaseStartup(f.options)).rejects.toThrow('cancelled');
  await expect(runEmbeddedDatabaseStartup({ ...f.options, timeoutMs: Infinity })).rejects.toThrow('timeout_invalid');
  expect(f.options.launch).not.toHaveBeenCalled();
});

test('process death interrupts a pending readiness probe without another signal', async () => {
  const f = fixture();
  f.options.probe.mockImplementation(() => { f.finish({ code: 1 }); return new Promise(() => {}); });
  await expect(runEmbeddedDatabaseStartup(f.options)).rejects.toThrow('exited');
  expect(f.child.signal).not.toHaveBeenCalled();
});

test('shutdown uncertainty is explicit and never escalates to a database SIGKILL', async () => {
  const f = fixture();
  f.options.probe.mockRejectedValue(new Error('private provider details'));
  f.child.signal.mockImplementation(() => {});
  await expect(runEmbeddedDatabaseStartup({ ...f.options, waitForExit: async () => { throw new Error('timeout'); } })).rejects.toThrow();
  expect(f.child.signal.mock.calls).toEqual([['SIGINT']]);
  expect(f.options.report).toHaveBeenLastCalledWith({ status: 'shutdown_unconfirmed' });
  expect(JSON.stringify(f.options.report.mock.calls)).not.toContain('private provider');
  expect(f.child.detach).toHaveBeenCalledTimes(1);
});
