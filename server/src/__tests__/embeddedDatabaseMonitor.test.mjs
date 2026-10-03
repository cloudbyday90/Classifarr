/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { watchEmbeddedDatabase } from '../bootstrap/embeddedDatabaseMonitor.mjs';

function fixture(states) {
  let time = 0;
  const abort = new AbortController();
  const requestStop = jest.fn(() => abort.abort());
  const probe = jest.fn(async () => ({ joined: true, ...states.shift() }));
  return { abort, options: { database: {}, signal: abort.signal, requestStop, probe,
    now: () => time, report: jest.fn(), delay: jest.fn(async ms => { time += ms; }) }, advance: ms => { time += ms; } };
}
const transient = { state: 'transient', reason: 'database_probe_timeout' };

test('one transient failure recovers without requesting a stop', async () => {
  const f = fixture([transient, { state: 'ok' }]);
  f.options.delay.mockImplementationOnce(async () => f.advance(5000)).mockImplementationOnce(async () => f.advance(5000))
    .mockImplementationOnce(async () => f.abort.abort());
  expect(await watchEmbeddedDatabase(f.options)).toEqual({ joined: true });
  expect(f.options.requestStop).not.toHaveBeenCalled();
  expect(f.options.report.mock.calls).toEqual([['database_probe_waiting', 'database_probe_timeout'], ['database_probe_recovered']]);
});
test('repeated transient failures cannot extend the first grace deadline', async () => {
  const f = fixture([transient, transient, transient, transient]);
  await watchEmbeddedDatabase(f.options);
  expect(f.options.now()).toBe(20_000);
  expect(f.options.probe).toHaveBeenCalledTimes(3);
  expect(f.options.report).toHaveBeenCalledTimes(1);
  expect(f.options.requestStop.mock.calls).toEqual([[{ reason: 'database_probe_grace_expired', failed: true }]]);
});
test('concrete failure during grace stops immediately', async () => {
  const f = fixture([transient, { state: 'failed' }]);
  await watchEmbeddedDatabase(f.options);
  expect(f.options.now()).toBe(10_000);
  expect(f.options.requestStop).toHaveBeenCalledWith({ reason: 'database_unavailable', failed: true });
});
test('success after the grace deadline does not reset it', async () => {
  const f = fixture([transient]);
  f.options.probe.mockImplementationOnce(async () => ({ ...transient, joined: true }))
    .mockImplementationOnce(async () => { f.advance(12_000); return { state: 'ok', joined: true }; });
  await watchEmbeddedDatabase(f.options);
  expect(f.options.requestStop).toHaveBeenCalledWith({ reason: 'database_probe_grace_expired', failed: true });
  expect(f.options.report).not.toHaveBeenCalledWith('database_probe_recovered');
});
test('unjoined work prevents any next probe and is explicit even during shutdown', async () => {
  const f = fixture([]);
  f.options.probe.mockImplementation(async () => { f.abort.abort(); return { state: 'unjoined', joined: false }; });
  expect(await watchEmbeddedDatabase(f.options)).toEqual({ joined: false });
  expect(f.options.probe).toHaveBeenCalledTimes(1);
  expect(f.options.report).toHaveBeenCalledWith('database_probe_exit_unconfirmed');
});

test('a broken diagnostic sink cannot authorize shutdown over an unjoined probe', async () => {
  const f = fixture([{ state: 'unjoined', joined: false }]);
  f.options.report.mockImplementation(() => { throw new Error('broken pipe'); });
  expect(await watchEmbeddedDatabase(f.options)).toEqual({ joined: false });
  expect(f.options.probe).toHaveBeenCalledTimes(1);
  expect(f.options.requestStop).toHaveBeenCalledWith({ reason: 'database_probe_exit_unconfirmed', failed: true });
});

test('probe budget is clipped to the grace window, which renews only after verified recovery', async () => {
  const f = fixture([transient]);
  f.options.probe.mockImplementationOnce(async () => ({ ...transient, joined: true }))
    .mockImplementationOnce(async (_check, { timeoutMs }) => {
      expect(timeoutMs).toBe(2000);
      return { state: 'ok', joined: true };
    }).mockImplementationOnce(async (_check, { timeoutMs }) => {
      expect(timeoutMs).toBe(3000);
      f.abort.abort();
      return { state: 'cancelled', joined: true };
    });
  f.options.delay.mockImplementationOnce(async () => f.advance(5000))
    .mockImplementationOnce(async () => f.advance(13_000))
    .mockImplementationOnce(async () => f.advance(5000));
  await watchEmbeddedDatabase(f.options);
  expect(f.options.requestStop).not.toHaveBeenCalled();
  expect(f.options.report).toHaveBeenCalledWith('database_probe_recovered');
});
