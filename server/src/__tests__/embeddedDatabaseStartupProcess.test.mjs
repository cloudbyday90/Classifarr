/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createEmbeddedDatabaseStartupProcess } from '../bootstrap/embeddedDatabaseStartupProcess.mjs';

const identity = '123\n/app/data/postgres\n1790000000\n5432\n/run/postgresql\nlocalhost\n123 456\nready\n';
function fixture() {
  const child = Object.assign(new EventEmitter(), { pid: 123, kill: jest.fn(), unref: jest.fn() });
  const input = { spawnFn: jest.fn(() => child), run: jest.fn(async () => ({})), read: jest.fn(async () => identity),
    openLog: jest.fn(() => 42), closeLog: jest.fn(), environment: { TZ: 'UTC' } };
  return { child, input, adapter: createEmbeddedDatabaseStartupProcess(input) };
}

test('starts one fixed postgres directly as a detached observed child with file-backed logs', async () => {
  const f = fixture();
  const child = f.adapter.launch();
  expect(f.input.spawnFn).toHaveBeenCalledWith('/usr/libexec/postgresql18/postgres', ['-D', '/app/data/postgres'], {
    cwd: '/app', env: { TZ: 'UTC', LC_ALL: 'C' }, shell: false, detached: true, stdio: ['ignore', 42, 42],
  });
  expect(f.input.closeLog.mock.calls).toEqual([[42]]);
  child.signal('SIGINT');
  expect(f.child.kill.mock.calls).toEqual([['SIGINT']]);
  f.child.emit('exit', 1, null);
  expect(await child.done).toEqual({ code: 1, signal: null });
  child.signal('SIGINT');
  expect(f.child.kill).toHaveBeenCalledTimes(1);
  child.detach();
  expect(f.child.unref).toHaveBeenCalledTimes(1);
});

test('closes the parent log descriptor even if spawning fails', () => {
  const f = fixture();
  f.input.spawnFn.mockImplementation(() => { throw new Error('spawn'); });
  expect(() => f.adapter.launch()).toThrow('spawn');
  expect(f.input.closeLog.mock.calls).toEqual([[42]]);
});

test('launch strips inherited PID exemptions and only uses the preflight environment', async () => {
  const f = fixture();
  f.input.environment.PG_GRANDPARENT_PID = 'unverified';
  const prepareEnvironment = jest.fn(async () => ({ environment: { LC_ALL: 'C', PG_GRANDPARENT_PID: '157' }, ownThreadCollision: true }));
  const adapter = createEmbeddedDatabaseStartupProcess({ ...f.input, prepareEnvironment });
  adapter.launch();
  expect(f.input.spawnFn.mock.calls[0][2].env).not.toHaveProperty('PG_GRANDPARENT_PID');
  expect(await adapter.prepare()).toEqual({ ownThreadCollision: true });
  adapter.launch();
  expect(f.input.spawnFn.mock.calls[1][2].env.PG_GRANDPARENT_PID).toBe('157');
});

test('requires own PID, fixed port, native ready state and successful local probe with identity readback', async () => {
  const f = fixture();
  expect(await f.adapter.probe(123)).toMatchObject({ ready: true });
  expect(f.input.read).toHaveBeenCalledTimes(2);
  expect(f.input.run).toHaveBeenCalledWith('/usr/libexec/postgresql18/pg_isready',
    ['-h', '/run/postgresql', '-p', '5432', '-U', 'classifarr', '-d', 'postgres', '-t', '1', '-q'],
    expect.objectContaining({ timeout: 2000, shell: false, maxBuffer: 4096, env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } }));
});

test.each(['', identity.replace('123\n', '999\n'), '123\n', identity.replace('ready', 'starting')])('never trusts another or partially written startup identity', async text => {
  const f = fixture();
  f.input.read.mockResolvedValue(text);
  expect(await f.adapter.probe(123)).toMatchObject({ ready: false });
  expect(f.input.run).not.toHaveBeenCalled();
  expect(f.child.kill).not.toHaveBeenCalled();
});

test.each([1, 2])('connection status %s is waiting, not success', async code => {
  const f = fixture();
  f.input.run.mockRejectedValue({ code });
  expect(await f.adapter.probe(123)).toMatchObject({ ready: false });
});

test('invalid probe invocation and permission failures are not disguised as recovery', async () => {
  const f = fixture();
  f.input.run.mockRejectedValue({ code: 3 });
  await expect(f.adapter.probe(123)).rejects.toEqual({ code: 3 });
  f.input.read.mockRejectedValue({ code: 'EACCES' });
  await expect(f.adapter.probe(123)).rejects.toEqual({ code: 'EACCES' });
});

test('a bounded readiness probe timeout waits, but host cancellation still fails', async () => {
  const f = fixture();
  f.input.run.mockRejectedValue({ killed: true, signal: 'SIGKILL' });
  expect(await f.adapter.probe(123)).toEqual({ ready: false, phase: 'waiting_for_connections' });
  const abort = new AbortController();
  f.input.run.mockImplementation(async () => { abort.abort(); throw { killed: true, signal: 'SIGKILL' }; });
  await expect(f.adapter.probe(123, abort.signal)).rejects.toThrow();
});

test('changed identity or port refuses readiness', async () => {
  const f = fixture();
  f.input.read.mockResolvedValueOnce(identity).mockResolvedValue(identity.replace('1790000000', '1790000001'));
  await expect(f.adapter.probe(123)).rejects.toThrow('identity_changed');
  f.input.read.mockResolvedValue(identity.replace('5432', '5433'));
  await expect(f.adapter.probe(123)).rejects.toThrow('port_invalid');
});

test('a cancelled slow read cannot launch a later readiness subprocess', async () => {
  const f = fixture();
  const abort = new AbortController();
  f.input.read.mockImplementation(async () => { abort.abort(); return identity; });
  await expect(f.adapter.probe(123, abort.signal)).rejects.toThrow();
  expect(f.input.run).not.toHaveBeenCalled();
});

test('entrypoint preserves native PID locks and replaces both old wait loops', () => {
  const shell = readFileSync(new URL('../../../docker-entrypoint.sh', import.meta.url), 'utf8');
  expect(shell).not.toContain('rm -f "$PG_DATA/postmaster.pid"');
  expect(shell).not.toContain('wait_for_postgres_or_exit');
  expect(shell).toContain('runEmbeddedDatabaseStartup.mjs --check');
  expect(shell).toContain('su-exec classifarr node /app/src/scripts/runEmbeddedDatabaseStartup.mjs --run &');
  expect(shell).toContain('wait "$POSTGRES_STARTUP_PID"');
});
