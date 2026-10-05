/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { launchSelectedDatabase, verifySelectedDatabaseShutdown } from '../bootstrap/embeddedSelectedDatabaseProcess.mjs';

function fixture() {
  const child = new EventEmitter(); child.pid = 123; child.stdout = new EventEmitter(); child.kill = jest.fn();
  return { child, spawnFn: jest.fn(() => child) };
}

test('launch uses exact binary, account, paths and isolated environment without shell or detach', () => {
  const f = fixture(); const observed = launchSelectedDatabase({ uid: 70, gid: 70 }, f.spawnFn);
  const [command, args, options] = f.spawnFn.mock.calls[0];
  expect(command).toBe('/sbin/su-exec');
  expect(args.slice(0, 4)).toEqual(['70:70', '/usr/libexec/postgresql18/postgres', '-D', '/app/data/embedded-postgres/candidate']);
  expect(args).toEqual(expect.arrayContaining(['data_directory=/app/data/embedded-postgres/candidate',
    'config_file=/app/data/embedded-postgres/postgresql.conf', 'hba_file=/app/data/embedded-postgres/pg_hba.conf',
    'ident_file=/app/data/embedded-postgres/pg_ident.conf', 'listen_addresses=', 'port=5432']));
  expect(options).toEqual({ cwd: '/app', shell: false, env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }, stdio: 'ignore' });
  expect(observed.pid).toBe(123); observed.detach();
  expect(() => launchSelectedDatabase({ uid: 0, gid: 70 }, f.spawnFn)).toThrow('identity_invalid');
});

test('clean-control helper joins exit and closed output, not just signal delivery', async () => {
  const f = fixture(); const result = verifySelectedDatabaseShutdown(f); let finished = false;
  result.then(() => { finished = true; });
  f.child.stdout.emit('data', Buffer.from('Database cluster state: shut down\n'));
  f.child.emit('exit', 0, null); await Promise.resolve(); expect(finished).toBe(false);
  f.child.emit('close'); await result;
  expect(f.spawnFn.mock.calls[0][0]).toBe('/usr/libexec/postgresql18/pg_controldata');
});

test.each(['unclean', 'exit', 'overflow', 'stream', 'cancel'])('control rejects %s', async failure => {
  const f = fixture(), controller = new AbortController();
  const result = verifySelectedDatabaseShutdown({ ...f, signal: controller.signal });
  const rejected = expect(result).rejects.toThrow();
  if (failure === 'unclean') f.child.stdout.emit('data', Buffer.from('Database cluster state: in production\n'));
  if (failure === 'overflow') f.child.stdout.emit('data', Buffer.alloc(16385));
  if (failure === 'stream') f.child.stdout.emit('error', new Error('private_data'));
  if (failure === 'cancel') controller.abort();
  f.child.emit('exit', failure === 'exit' ? 1 : 0, null); f.child.emit('close');
  await rejected;
  if (['overflow', 'stream', 'cancel'].includes(failure)) expect(f.child.kill).toHaveBeenCalledWith('SIGKILL');
});
