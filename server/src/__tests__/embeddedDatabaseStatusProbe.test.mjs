/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runEmbeddedDatabaseStatusProbe } from '../bootstrap/embeddedDatabaseStatusProbe.mjs';

const tick = () => Promise.resolve();
function fixture() {
  const child = Object.assign(new EventEmitter(), { pid: 123, kill: jest.fn() });
  return { child, spawnFn: jest.fn(() => child), abort: new AbortController() };
}
afterEach(() => jest.useRealTimers());

test('fixed read-only status command discards output and observes successful exit', async () => {
  const f = fixture();
  const result = runEmbeddedDatabaseStatusProbe(f);
  expect(f.spawnFn).toHaveBeenCalledWith('/usr/libexec/postgresql18/pg_ctl', ['-D', '/app/data/postgres', 'status'], {
    cwd: '/app', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }, shell: false, stdio: 'ignore',
  });
  f.child.emit('exit', 0, null);
  await expect(result).resolves.toBeUndefined();
  expect(f.child.kill).not.toHaveBeenCalled();
});

test.each([3, 4, 1])('status exit %s remains a concrete failure', async code => {
  const f = fixture();
  const result = runEmbeddedDatabaseStatusProbe(f);
  f.child.emit('exit', code, null);
  await expect(result).rejects.toThrow(code === 3 ? 'database_not_running' : 'database_status_failed');
});

test('timeout kills only the helper and waits for its actual exit', async () => {
  jest.useFakeTimers();
  const f = fixture();
  let settled = false;
  const result = runEmbeddedDatabaseStatusProbe(f);
  const assertion = expect(result.finally(() => { settled = true; })).rejects.toMatchObject({ code: 'database_probe_timeout' });
  await jest.advanceTimersByTimeAsync(2000);
  expect(f.child.kill.mock.calls).toEqual([['SIGKILL']]);
  expect(settled).toBe(false);
  f.child.emit('exit', null, 'SIGKILL');
  await assertion;
  expect(jest.getTimerCount()).toBe(0);
});

test('cancellation cannot pretend successful signal delivery is exit', async () => {
  const f = fixture();
  let settled = false;
  const result = runEmbeddedDatabaseStatusProbe({ ...f, signal: f.abort.signal });
  const assertion = expect(result.finally(() => { settled = true; })).rejects.toMatchObject({ name: 'AbortError' });
  f.abort.abort(); await tick();
  expect(settled).toBe(false);
  expect(f.child.kill.mock.calls).toEqual([['SIGKILL']]);
  f.child.emit('exit', null, 'SIGKILL');
  await assertion;
});

test.each(['EAGAIN', 'EMFILE', 'ENFILE', 'ENOENT', 'EACCES'])('spawn error %s is classified conservatively', async code => {
  const f = fixture();
  delete f.child.pid;
  const result = runEmbeddedDatabaseStatusProbe(f);
  f.child.emit('error', Object.assign(new Error('private details'), { code }));
  await expect(result).rejects.toMatchObject({ code: ['EAGAIN', 'EMFILE', 'ENFILE'].includes(code) ? 'database_probe_resource_pressure' : code });
});

test('pre-cancelled check does not spawn', async () => {
  const f = fixture(); f.abort.abort();
  await expect(runEmbeddedDatabaseStatusProbe({ ...f, signal: f.abort.signal })).rejects.toThrow();
  expect(f.spawnFn).not.toHaveBeenCalled();
});
