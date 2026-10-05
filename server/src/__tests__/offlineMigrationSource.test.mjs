/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { readOfflineMigrationSource } from '../bootstrap/offlineMigrationSource.mjs';
import { readOfflineMigrationControl } from '../bootstrap/offlineMigrationControl.mjs';

function fixture() {
  return { source: '/app/data/postgres', candidate: '/app/data/embedded-postgres/candidate',
    protect: jest.fn(async () => {}), accounts: async () => ({ users: [{ name: 'classifarr', uid: 1000, gid: 1000 }, { name: 'postgres', uid: 70, gid: 70 }] }),
    stat: async () => ({ isDirectory: () => true, isSymbolicLink: () => false, uid: 1000, gid: 1000, mode: 0o700 }),
    version: jest.fn(async () => {}), control: jest.fn(async () => '123456'),
    inspect: jest.fn(async () => ({ entries: [{ relative: '', directory: true }], bytes: 0 })), digest: jest.fn(async () => 'a'.repeat(64)) };
}
test('source observation binds both actual identities, layout, digest and independently read control ID', async () => {
  const f = fixture(), result = await readOfflineMigrationSource(f);
  expect(result.record).toMatchObject({ applicationUid: 1000, databaseUid: 70, source: f.source, candidate: f.candidate, systemId: '123456' });
  expect(f.control).toHaveBeenCalledTimes(2); expect(f.protect).toHaveBeenCalledWith('/app/data');
  expect(f.protect).toHaveBeenCalledWith('/app/data/embedded-postgres');
});
test.each(['postmaster.pid', 'standby.signal', 'recovery.signal'])('refuses %s before control/hash reads', async relative => {
  const f = fixture(); f.inspect.mockResolvedValue({ entries: [{ relative }] });
  await expect(readOfflineMigrationSource(f)).rejects.toThrow('not_stopped'); expect(f.control).not.toHaveBeenCalled();
});
test('wrong source owner, unsupported version, changed control ID and cancellation refuse', async () => {
  const f = fixture(); f.stat = async () => ({ uid: 0, isDirectory: () => true, isSymbolicLink: () => false });
  await expect(readOfflineMigrationSource(f)).rejects.toThrow('permissions_invalid');
  const v = fixture(); v.version.mockRejectedValue(new Error('version_invalid'));
  await expect(readOfflineMigrationSource(v)).rejects.toThrow('version_invalid');
  const c = fixture(); c.control.mockResolvedValueOnce('123456').mockResolvedValueOnce('123457');
  await expect(readOfflineMigrationSource(c)).rejects.toThrow('source_changed');
  await expect(readOfflineMigrationSource({ ...fixture(), signal: AbortSignal.abort() })).rejects.toThrow();
});

function childFixture() {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.kill = jest.fn();
  return { child, spawnFn: jest.fn(() => child), finish: (code = 0) => { child.emit('exit', code, null); child.emit('close'); } };
}
const clean = 'Database system identifier: 123456\nDatabase cluster state: shut down\n';
test('bounded fixed control helper waits for both exit and close and scrubs the environment', async () => {
  const f = childFixture(); let done = false;
  const task = readOfflineMigrationControl('/app/data/postgres', f).then(value => { done = true; return value; });
  f.child.stdout.emit('data', Buffer.from(clean)); f.child.emit('exit', 0, null);
  await Promise.resolve(); expect(done).toBe(false); f.child.emit('close');
  expect(await task).toBe('123456');
  expect(f.spawnFn).toHaveBeenCalledWith('/usr/libexec/postgresql18/pg_controldata', ['/app/data/postgres'], expect.objectContaining({ shell: false, env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } }));
});
test.each(['running', 'overflow', 'cancel', 'exit'])('control failure %s is sanitized', async kind => {
  const f = childFixture(), controller = new AbortController();
  const task = readOfflineMigrationControl('/app/data/postgres', { ...f, signal: controller.signal });
  const rejected = expect(task).rejects.toThrow('migration_source_not_stopped');
  f.child.stdout.emit('data', Buffer.from(kind === 'running' ? clean.replace('shut down', 'in production') : kind === 'overflow' ? 'x'.repeat(16385) : clean));
  if (kind === 'cancel') controller.abort(); f.finish(kind === 'exit' ? 1 : 0); await rejected;
});

test.each([true, false])('control deadline kills the helper and requires a joined exit (%s)', async joins => {
  jest.useFakeTimers();
  try {
    const f = childFixture();
    if (joins) f.child.kill.mockImplementation(() => { f.finish(); return true; });
    const task = readOfflineMigrationControl('/app/data/postgres', f);
    const rejected = expect(task).rejects.toThrow(joins ? 'migration_source_not_stopped' : 'migration_source_control_unjoined');
    await jest.advanceTimersByTimeAsync(2000);
    expect(f.child.kill).toHaveBeenCalledWith('SIGKILL');
    if (!joins) await jest.advanceTimersByTimeAsync(2000);
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('failed spawn closes without exposing its error details', async () => {
  const f = childFixture(), task = readOfflineMigrationControl('/app/data/postgres', f);
  const rejected = expect(task).rejects.toThrow('migration_source_not_stopped');
  f.child.emit('error', new Error('synthetic private diagnostic')); f.child.emit('close');
  await rejected;
});
