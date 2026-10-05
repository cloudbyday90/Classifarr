/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { posix } from 'node:path';

const fs = Object.fromEntries(['lstat', 'open', 'rename'].map(key => [key, jest.fn()]));
const spawnSync = jest.fn();
jest.unstable_mockModule('node:fs/promises', () => fs);
jest.unstable_mockModule('node:child_process', () => ({ spawnSync }));
jest.unstable_mockModule('node:path', () => ({ dirname: posix.dirname, join: posix.join, resolve: posix.resolve }));
const { withEmbeddedMigrationJournal } = await import('../bootstrap/embeddedMigrationJournal.mjs');
let platform, uid, files;
beforeEach(() => {
  jest.resetAllMocks();
  platform = Object.getOwnPropertyDescriptor(process, 'platform');
  uid = Object.getOwnPropertyDescriptor(process, 'getuid');
  Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' });
  Object.defineProperty(process, 'getuid', { configurable: true, value: () => 0 });
  fs.lstat.mockResolvedValue({ uid: 0, mode: 0o755, isDirectory: () => true, isSymbolicLink: () => false });
  files = [];
  fs.open.mockImplementation(async () => {
    const file = { fd: 7, stat: jest.fn(async () => ({ uid: 0, mode: 0o600, nlink: 1, size: 2, isFile: () => true })),
      close: jest.fn(async () => {}), readFile: jest.fn(async () => '{}'), truncate: jest.fn(async () => {}),
      writeFile: jest.fn(async () => {}), sync: jest.fn(async () => {}) };
    files.push(file);
    return file;
  });
  spawnSync.mockReturnValue({ status: 0 });
});
afterEach(() => {
  Object.defineProperty(process, 'platform', platform);
  if (uid) Object.defineProperty(process, 'getuid', uid); else delete process.getuid;
});
const root = '/identity-migration';
test('lock held by parent descriptor; journal fsync precedes rename and directory fsync', async () => {
  await withEmbeddedMigrationJournal(root, async journal => { expect(await journal.read()).toEqual({}); await journal.write({ safe: true }); });
  expect(spawnSync).toHaveBeenCalledWith('/bin/busybox', ['flock', '-n', '3'], expect.objectContaining({ shell: false, timeout: 5000, stdio: ['ignore', 'ignore', 'ignore', 7] }));
  expect(files[2].sync.mock.invocationCallOrder[0]).toBeLessThan(fs.rename.mock.invocationCallOrder[0]);
  expect(fs.rename.mock.invocationCallOrder[0]).toBeLessThan(files[3].sync.mock.invocationCallOrder[0]);
  expect(files.every(file => file.close.mock.calls.length === 1)).toBe(true);
});
test.each(['not-root', 'not-linux', 'writable', 'symlink', 'foreign-owner', 'not-directory'])('%s refuses before opening lock', async kind => {
  if (kind === 'not-root') Object.defineProperty(process, 'getuid', { configurable: true, value: () => 1000 });
  if (kind === 'not-linux') Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
  fs.lstat.mockResolvedValue({ uid: kind === 'foreign-owner' ? 1000 : 0, mode: kind === 'writable' ? 0o777 : 0o755,
    isDirectory: () => kind !== 'not-directory', isSymbolicLink: () => kind === 'symlink' });
  await expect(withEmbeddedMigrationJournal(root, async () => {})).rejects.toThrow('migration_protected_directory_required');
  expect(fs.open).not.toHaveBeenCalled();
});
test('busy lock or callback failure always closes parent descriptor', async () => {
  spawnSync.mockReturnValue({ status: 1 });
  await expect(withEmbeddedMigrationJournal(root, async () => {})).rejects.toThrow('migration_lock_unavailable');
  expect(files[0].close).toHaveBeenCalledTimes(1);
  spawnSync.mockReturnValue({ status: 0 });
  await expect(withEmbeddedMigrationJournal(root, async () => { throw new Error('interrupted'); })).rejects.toThrow('interrupted');
  expect(files[1].close).toHaveBeenCalledTimes(1);
});
test.each([{ uid: 1000 }, { mode: 0o644 }, { nlink: 2 }, { size: 8193 }, { isFile: () => false }])('rejects unsafe journal metadata %j and closes it', async change => {
  const original = fs.open.getMockImplementation();
  fs.open.mockImplementation(async (...args) => {
    const file = await original(...args);
    const metadata = await file.stat();
    file.stat.mockResolvedValue({ ...metadata, ...change });
    return file;
  });
  await expect(withEmbeddedMigrationJournal(root, async () => {})).rejects.toThrow('migration_journal_file_invalid');
  expect(files[0].close).toHaveBeenCalledTimes(1);
  expect(spawnSync).not.toHaveBeenCalled();
});
test('missing journal is initial state, malformed JSON is not', async () => {
  await withEmbeddedMigrationJournal(root, async journal => {
    fs.open.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    expect(await journal.read()).toBeNull();
    const original = fs.open.getMockImplementation();
    fs.open.mockImplementationOnce(async (...args) => { const file = await original(...args); file.readFile.mockResolvedValue('{'); return file; });
    await expect(journal.read()).rejects.toThrow();
  });
});
test('failed fsync leaves previous receipt unchanged and releases lock', async () => {
  await expect(withEmbeddedMigrationJournal(root, async journal => {
    const original = fs.open.getMockImplementation();
    fs.open.mockImplementationOnce(async (...args) => { const file = await original(...args); file.sync.mockRejectedValue(new Error('disk_failed')); return file; });
    await journal.write({ pending: 'copy' });
  })).rejects.toThrow('disk_failed');
  expect(fs.rename).not.toHaveBeenCalled();
  expect(files.every(file => file.close.mock.calls.length === 1)).toBe(true);
});

test.each(['selection', 'source'])('%s uses the same held lock and separate fixed durable receipt names', async name => {
  await withEmbeddedMigrationJournal(root, async journal => {
    await journal[name].read();
    await journal[name].write({ version: 1, phase: 'selected' });
    expect(files[0].close).not.toHaveBeenCalled();
  });
  expect(spawnSync).toHaveBeenCalledTimes(1);
  expect(fs.open.mock.calls.map(call => call[0])).toEqual([
    '/identity-migration/migration.lock', `/identity-migration/${name}.json`,
    `/identity-migration/${name}.next`, '/identity-migration',
  ]);
  expect(fs.rename).toHaveBeenCalledWith(`/identity-migration/${name}.next`, `/identity-migration/${name}.json`);
  expect(files[2].sync.mock.invocationCallOrder[0]).toBeLessThan(fs.rename.mock.invocationCallOrder[0]);
  expect(fs.rename.mock.invocationCallOrder[0]).toBeLessThan(files[3].sync.mock.invocationCallOrder[0]);
  expect(files.every(file => file.close.mock.calls.length === 1)).toBe(true);
});

test('selection read rejects unsafe metadata without treating it as absence', async () => {
  await withEmbeddedMigrationJournal(root, async journal => {
    const original = fs.open.getMockImplementation();
    fs.open.mockImplementationOnce(async (...args) => {
      const file = await original(...args);
      file.stat.mockResolvedValue({ uid: 1000, mode: 0o600, nlink: 1, size: 2, isFile: () => true });
      return file;
    });
    await expect(journal.selection.read()).rejects.toThrow('journal_file_invalid');
  });
  expect(files.every(file => file.close.mock.calls.length === 1)).toBe(true);
});
