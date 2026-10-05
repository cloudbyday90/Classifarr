/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { constants, readFileSync } from 'node:fs';
import { prepareSelectedDatabase, readSelectedDatabaseFile } from '../bootstrap/embeddedSelectedDatabaseLayout.mjs';

function fixture() {
  const database = { name: 'postgres', uid: 70, gid: 70 }, app = { name: 'classifarr', uid: 1000, gid: 1000 };
  const entry = { isDirectory: () => true, isSymbolicLink: () => false, uid: 70, gid: 70, mode: 0o700 };
  const options = { protect: jest.fn(), stat: jest.fn(async () => entry), accounts: async () => ({ users: [database, app] }),
    read: jest.fn(async kind => { if (kind === 'pid') throw Object.assign(new Error(), { code: 'ENOENT' }); return kind === 'version' ? '18\n' : ''; }) };
  return { database, app, entry, options };
}

test('requires protected ancestors and separate accounts without changing permissions', async () => {
  const f = fixture(); expect(await prepareSelectedDatabase(f.options)).toEqual({ uid: 70, gid: 70 });
  expect(f.options.protect).toHaveBeenCalledTimes(1);
  expect(f.options.protect).toHaveBeenCalledWith('/app/data/embedded-postgres');
  expect(f.options.read.mock.calls.map(([kind, uid]) => [kind, uid])).toEqual([
    ['config', 0], ['hba', 0], ['ident', 0], ['auto', 70], ['version', 70], ['pid', 70],
  ]);
});

test.each(['protect', 'uid', 'gid', 'root_uid', 'symlink', 'file', 'world_write', 'readable_data', 'wrong_owner', 'wrong_group', 'auto', 'version', 'pid', 'read_error'])('refuses %s before launch', async failure => {
  const f = fixture();
  if (failure === 'protect') f.options.protect.mockRejectedValue(new Error('unsafe_parent'));
  if (failure === 'uid') f.database.uid = 1000;
  if (failure === 'gid') f.database.gid = 1000;
  if (failure === 'root_uid') f.database.uid = 0;
  if (failure === 'symlink') f.entry.isSymbolicLink = () => true;
  if (failure === 'file') f.entry.isDirectory = () => false;
  if (failure === 'world_write') f.entry.mode = 0o702;
  if (failure === 'readable_data') f.entry.mode = 0o750;
  if (failure === 'wrong_owner') f.entry.uid = 1000;
  if (failure === 'wrong_group') f.entry.gid = 1000;
  if (failure === 'auto') f.options.read.mockImplementation(async kind => kind === 'auto' ? "archive_command='unsafe'" : '');
  if (failure === 'version') f.options.read.mockImplementation(async kind => kind === 'version' ? '17' : '');
  if (failure === 'pid') f.options.read.mockImplementation(async kind => kind === 'version' ? '18' : '');
  if (failure === 'read_error') f.options.read.mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
  await expect(prepareSelectedDatabase(f.options)).rejects.toThrow();
});

test('cancellation does not proceed through further file reads', async () => {
  const f = fixture(), controller = new AbortController();
  f.options.protect.mockImplementation(() => controller.abort());
  await expect(prepareSelectedDatabase({ ...f.options, signal: controller.signal })).rejects.toThrow();
  expect(f.options.stat).not.toHaveBeenCalled(); expect(f.options.read).not.toHaveBeenCalled();
});

function fileFixture() {
  const stat = { isFile: () => true, uid: 70, nlink: 1, mode: 0o600, size: 3 };
  const file = { stat: jest.fn(async () => stat), close: jest.fn(), read: jest.fn(async (buffer, offset) => {
    if (offset) return { bytesRead: 0 }; buffer.write('18\n'); return { bytesRead: 3 };
  }) };
  return { stat, file, openFile: jest.fn(async () => file) };
}

test('bounded file read uses fixed path, no-follow and always closes', async () => {
  const f = fileFixture();
  expect(await readSelectedDatabaseFile('version', 70, f)).toBe('18\n');
  expect(f.openFile).toHaveBeenCalledWith('/app/data/embedded-postgres/candidate/PG_VERSION',
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  expect(f.file.close).toHaveBeenCalledTimes(1);
  await expect(readSelectedDatabaseFile('../secrets', 70, f)).rejects.toThrow('file_invalid');
  expect(f.openFile).toHaveBeenCalledTimes(1);
});

test.each(['type', 'owner', 'links', 'mode', 'size', 'growing', 'read'])('bounded reader rejects %s and closes', async failure => {
  const f = fileFixture();
  if (failure === 'type') f.stat.isFile = () => false;
  if (failure === 'owner') f.stat.uid = 0;
  if (failure === 'links') f.stat.nlink = 2;
  if (failure === 'mode') f.stat.mode = 0o622;
  if (failure === 'size') f.stat.size = 2048;
  if (failure === 'growing') f.file.read.mockResolvedValue({ bytesRead: 2048 });
  if (failure === 'read') f.file.read.mockRejectedValue(new Error('io'));
  await expect(readSelectedDatabaseFile('pid', 70, f)).rejects.toThrow();
  expect(f.file.close).toHaveBeenCalledTimes(1);
});

test('compatible entrypoint rejects even dangling protected layout before data or account changes', () => {
  const shell = readFileSync(new URL('../../../docker-entrypoint.sh', import.meta.url), 'utf8');
  const guard = shell.indexOf('if [ -e "$DATA_DIR/embedded-postgres" ] || [ -L "$DATA_DIR/embedded-postgres" ]');
  expect(guard).toBeGreaterThan(0);
  for (const operation of ['provisionEmbeddedIdentity.mjs --apply', 'mkdir -p "$PG_DATA"', 'chown -R']) {
    expect(shell.indexOf(operation)).toBeGreaterThan(guard);
  }
  expect(shell.slice(guard, shell.indexOf('fi', guard))).toContain('exit 1');
});
