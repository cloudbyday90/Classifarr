/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { constants } from 'node:fs';
import { provisionEmbeddedApplicationLayout } from '../bootstrap/embeddedApplicationLayout.mjs';

function fixture() {
  const paths = ['/app/data', '/app/data/config', '/app/data/secrets', '/app/data/logs', '/app/data/backups'];
  const records = new Map(paths.map((path, index) => {
    const stat = { uid: index ? 1000 : 0, gid: index ? 1000 : 0, mode: 0o755, dev: 1, isDirectory: () => true };
    return [path, { stat, file: { stat: jest.fn(async () => stat), close: jest.fn(), sync: jest.fn(),
      chmod: jest.fn(async mode => { stat.mode = mode; }), chown: jest.fn(async (uid, gid) => { stat.uid = uid; stat.gid = gid; }) } }];
  }));
  const directory = { read: jest.fn(async () => null), close: jest.fn() };
  const io = { open: jest.fn(async path => {
    if (!records.has(path)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    return records.get(path).file;
  }), mkdir: jest.fn(), opendir: jest.fn(async () => directory) };
  const users = [{ name: 'classifarr', uid: 1000, gid: 1000 }, { name: 'postgres', uid: 70, gid: 70 }];
  return { paths, records, io, directory, users, protect: jest.fn(), accounts: async () => ({ users }) };
}

test('all four directories inspected before descriptor writes; contents untouched', async () => {
  const f = fixture();
  expect(await provisionEmbeddedApplicationLayout(f)).toEqual({ uid: 1000, gid: 1000, directories: 4 });
  expect(f.protect).toHaveBeenCalledWith('/app/data');
  expect(f.io.mkdir).not.toHaveBeenCalled(); expect(f.io.opendir).not.toHaveBeenCalled();
  expect(f.io.open.mock.calls).toEqual(f.paths.map(path => [path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW]));
  for (const [path, { file }] of f.records) {
    expect(file.close).toHaveBeenCalledTimes(1); expect(file.sync).toHaveBeenCalledTimes(1);
    expect(file.chown).not.toHaveBeenCalled();
    if (path !== '/app/data') {
      expect(file.chmod).toHaveBeenCalledWith(0o700);
      expect(file.chmod.mock.invocationCallOrder[0]).toBeGreaterThan(f.io.open.mock.invocationCallOrder.at(-1));
    } else expect(file.chmod).not.toHaveBeenCalled();
  }
});

test.each(['protect', 'parent_owner', 'foreign_owner', 'foreign_group', 'mode', 'setgid', 'mount', 'file', 'link', 'nonempty_root', 'root_group', 'identity', 'alias'])('preflight %s refuses without writes', async failure => {
  const f = fixture(), entry = f.records.get('/app/data/backups');
  if (failure === 'protect') f.protect.mockRejectedValue(new Error('protected_parent_required'));
  if (failure === 'parent_owner') f.records.get('/app/data').stat.uid = 1000;
  if (failure === 'foreign_owner') entry.stat.uid = 70;
  if (failure === 'foreign_group') entry.stat.gid = 70;
  if (failure === 'mode') entry.stat.mode = 0o777;
  if (failure === 'setgid') entry.stat.mode = 0o2755;
  if (failure === 'mount') entry.stat.dev = 2;
  if (failure === 'file') entry.stat.isDirectory = () => false;
  if (failure === 'link') f.io.open.mockRejectedValue(Object.assign(new Error('link'), { code: 'ELOOP' }));
  if (failure === 'nonempty_root') { entry.stat.uid = 0; entry.stat.gid = 0; f.directory.read.mockResolvedValue({ name: 'untouched' }); }
  if (failure === 'root_group') { entry.stat.uid = 0; entry.stat.gid = 70; }
  if (failure === 'identity') f.users[0].uid = 70;
  if (failure === 'alias') f.users.push({ name: 'alias', uid: 1000, gid: 1000 });
  await expect(provisionEmbeddedApplicationLayout(f)).rejects.toThrow();
  expect(f.io.mkdir).not.toHaveBeenCalled();
  for (const { file } of f.records.values()) { expect(file.chmod).not.toHaveBeenCalled(); expect(file.chown).not.toHaveBeenCalled(); }
  if (failure === 'nonempty_root') expect(f.directory.close).toHaveBeenCalledTimes(1);
});

test.each([false, true])('creates/resumes an empty root child, handing ownership over last (new=%s)', async create => {
  const f = fixture(), path = '/app/data/backups', entry = f.records.get(path);
  entry.stat.uid = 0; entry.stat.gid = 0; entry.stat.mode = 0o700;
  if (create) { f.records.delete(path); f.io.mkdir.mockImplementation(async () => { f.records.set(path, entry); }); }
  await provisionEmbeddedApplicationLayout(f);
  expect(entry.file.chown).toHaveBeenCalledWith(1000, 1000);
  expect(entry.file.chown.mock.invocationCallOrder[0]).toBeGreaterThan(entry.file.chmod.mock.invocationCallOrder[0]);
  if (create) expect(f.io.mkdir).toHaveBeenCalledWith(path, { mode: 0o700 });
  else expect(f.directory.close).toHaveBeenCalledTimes(1);
});

test.each(['sync', 'chmod', 'close', 'readback'])('write/verification failure %s is not success; closes all handles', async failure => {
  const f = fixture(), file = f.records.get('/app/data/config').file;
  if (failure === 'readback') file.chmod.mockImplementation(async () => {});
  else file[failure].mockRejectedValue(new Error('io_failure'));
  await expect(provisionEmbeddedApplicationLayout(f)).rejects.toThrow();
  for (const { file: handle } of f.records.values()) expect(handle.close).toHaveBeenCalledTimes(1);
});

test('cancellation after one descriptor mutation prevents further writes and joins cleanup', async () => {
  const f = fixture(), controller = new AbortController();
  f.records.get('/app/data/config').file.chmod.mockImplementation(async () => { controller.abort(); });
  await expect(provisionEmbeddedApplicationLayout({ ...f, signal: controller.signal })).rejects.toThrow('cancelled');
  expect(f.records.get('/app/data/secrets').file.chmod).not.toHaveBeenCalled();
  for (const { file } of f.records.values()) expect(file.close).toHaveBeenCalledTimes(1);
});

test('already cancelled does not even inspect filesystem', async () => {
  const f = fixture();
  await expect(provisionEmbeddedApplicationLayout({ ...f, signal: AbortSignal.abort() })).rejects.toThrow('cancelled');
  expect(f.protect).not.toHaveBeenCalled(); expect(f.io.open).not.toHaveBeenCalled();
});

test('cancel after mkdir leaves an empty root-owned child that a restart can resume', async () => {
  const f = fixture(), path = '/app/data/backups', entry = f.records.get(path), controller = new AbortController();
  entry.stat.uid = 0; entry.stat.gid = 0; entry.stat.mode = 0o700;
  f.records.delete(path);
  f.io.mkdir.mockImplementation(async () => { f.records.set(path, entry); controller.abort(); });
  await expect(provisionEmbeddedApplicationLayout({ ...f, signal: controller.signal })).rejects.toThrow('cancelled');
  expect(entry.file.chown).not.toHaveBeenCalled();
  await expect(provisionEmbeddedApplicationLayout(f)).resolves.toEqual({ uid: 1000, gid: 1000, directories: 4 });
});

test('stalled filesystem operation exceeds deadline and bounded join; never admits success', async () => {
  jest.useFakeTimers();
  const f = fixture();
  let release;
  f.records.get('/app/data/config').file.sync.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  try {
    const assertion = expect(provisionEmbeddedApplicationLayout(f)).rejects.toThrow('database_operation_unjoined');
    await jest.advanceTimersByTimeAsync(11_000);
    await assertion;
    release();
    await jest.advanceTimersByTimeAsync(0);
    expect(f.records.get('/app/data/secrets').file.chmod).not.toHaveBeenCalled();
    for (const { file } of f.records.values()) expect(file.close).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
