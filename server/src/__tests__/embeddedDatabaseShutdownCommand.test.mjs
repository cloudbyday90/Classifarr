/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runEmbeddedDatabaseShutdownCommand } from '../bootstrap/embeddedDatabaseShutdownCommand.mjs';

function fixture(kind = 'stop', signal) {
  const child = Object.assign(new EventEmitter(), { pid: 123, stdout: new EventEmitter(), kill: jest.fn() });
  const spawnFn = jest.fn(() => child);
  const result = runEmbeddedDatabaseShutdownCommand(kind, { spawnFn, signal });
  const exit = (code = 0, signal = null) => { child.emit('exit', code, signal); child.emit('close', code, signal); };
  return { child, spawnFn, result, exit };
}

test.each(['stop', 'control'])('%s uses fixed executable, arguments, environment and bounded output', async kind => {
  const f = fixture(kind);
  expect(f.spawnFn).toHaveBeenCalledWith(`/usr/libexec/postgresql18/${kind === 'stop' ? 'pg_ctl' : 'pg_controldata'}`,
    kind === 'stop' ? ['-D', '/app/data/postgres', '-m', 'fast', '-w', '-t', '20', 'stop'] : ['/app/data/postgres'],
    { cwd: '/app', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }, shell: false,
      stdio: ['ignore', kind === 'control' ? 'pipe' : 'ignore', 'ignore'] });
  if (kind === 'control') f.child.stdout.emit('data', Buffer.from('clean\n'));
  f.exit();
  expect(await f.result).toEqual({ stdout: kind === 'control' ? 'clean\n' : '' });
});

test('exit alone is not proof that helper output is closed', async () => {
  const f = fixture('control');
  let settled = false;
  f.result.finally(() => { settled = true; });
  f.child.emit('exit', 0, null);
  await new Promise(resolve => { setImmediate(resolve); });
  expect(settled).toBe(false);
  f.child.stdout.emit('data', Buffer.from('final output'));
  f.child.emit('close', 0, null);
  expect(await f.result).toEqual({ stdout: 'final output' });
});

test.each([['stop', 22_000], ['control', 2000]])('%s deadline kills only the helper and requires actual exit', async (kind, timeout) => {
  jest.useFakeTimers();
  try {
    const f = fixture(kind);
    const assertion = expect(f.result).rejects.toThrow('command_unconfirmed');
    await jest.advanceTimersByTimeAsync(timeout);
    expect(f.child.kill).toHaveBeenCalledWith('SIGKILL');
    // Even an eventual exit code zero cannot turn a timeout into success.
    f.exit(); await assertion;
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test.each(['overflow', 'stream_error', 'exit_failure', 'signal', 'spawn_error', 'signal_error'])('rejects %s instead of claiming shutdown', async cause => {
  const f = fixture('control');
  const assertion = expect(f.result).rejects.toThrow('command_unconfirmed');
  if (cause === 'overflow') {
    f.child.stdout.emit('data', Buffer.alloc(65536));
    f.child.stdout.emit('data', Buffer.from('x'));
    expect(f.child.kill).toHaveBeenCalledWith('SIGKILL');
  }
  if (cause === 'stream_error') f.child.stdout.emit('error', new Error('unreadable'));
  if (cause === 'spawn_error') delete f.child.pid;
  if (['spawn_error', 'signal_error'].includes(cause)) f.child.emit('error', new Error('failed'));
  f.exit(cause === 'exit_failure' ? 1 : 0, cause === 'signal' ? 'SIGTERM' : null);
  await assertion;
});

test('abort joins the helper and cannot return partial output', async () => {
  const controller = new AbortController(), f = fixture('control', controller.signal);
  const assertion = expect(f.result).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  expect(f.child.kill).toHaveBeenCalledWith('SIGKILL');
  f.exit(); await assertion;
});

test('invalid commands and pre-cancelled work never spawn', async () => {
  const spawnFn = jest.fn();
  await expect(runEmbeddedDatabaseShutdownCommand('restart', { spawnFn })).rejects.toThrow('command_invalid');
  await expect(runEmbeddedDatabaseShutdownCommand('stop', { spawnFn, signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
  expect(spawnFn).not.toHaveBeenCalled();
});
