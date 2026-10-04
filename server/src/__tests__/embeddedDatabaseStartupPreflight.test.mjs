/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { prepareEmbeddedDatabaseStartupEnvironment as prepare } from '../bootstrap/embeddedDatabaseStartupPreflight.mjs';
import { readStartupOwnTask } from '../bootstrap/embeddedDatabaseStartupPreflight.mjs';

const identity = '157\n/app/data/postgres\n1790000000\n5432\n/run/postgresql\nlocalhost\n1 2\nready\n';
const task = 'Name:\tlibuv-worker\nPid:\t157\nTgid:\t143\n';
function fixture() {
  return { readPid: jest.fn(async () => identity), readTask: jest.fn(async () => task),
    processId: 143, environment: { TZ: 'UTC', PG_GRANDPARENT_PID: 'unsafe', LC_ALL: 'other' } };
}

test('verifies a persistent worker of this helper and unchanged identity before a native exception', async () => {
  const f = fixture();
  expect(await prepare(f)).toEqual({ ownThreadCollision: true,
    environment: { TZ: 'UTC', LC_ALL: 'C', PG_GRANDPARENT_PID: '157' } });
  expect(f.readTask.mock.calls).toEqual([['157', { signal: undefined }]]);
  expect(f.readPid).toHaveBeenCalledTimes(2);
  expect(f.environment.PG_GRANDPARENT_PID).toBe('unsafe');
});

test.each(['', '157\n', identity.replace('157', '-157'), identity.replace('157', '0'),
  identity.replace('157', '2147483648'), identity.replace('157', '../157'), identity.replace('157', '143'),
  identity.replace('/app/data/postgres', '/other'), identity.replace('1790000000', 'unknown')])(
  'missing or unqualified identity cannot grant an exception: %j', async text => {
    const f = fixture(); f.readPid.mockResolvedValue(text);
    expect(await prepare(f)).toEqual({ ownThreadCollision: false, environment: { TZ: 'UTC', LC_ALL: 'C' } });
    expect(f.readTask).not.toHaveBeenCalled();
  });

test.each([task.replace('143', '999'), task.replace('157', '158'), task.replace('libuv-worker', 'postgres'),
  task.replace('libuv-worker', 'node'), '', 'Name:\tlibuv-worker\n'])('does not trust a name, foreign process or transient thread alone', async text => {
  const f = fixture(); f.readTask.mockResolvedValue(text);
  expect(await prepare(f)).toEqual({ ownThreadCollision: false, environment: { TZ: 'UTC', LC_ALL: 'C' } });
  expect(f.readPid).toHaveBeenCalledTimes(1);
});

test.each(['ENOENT', 'EACCES', 'EIO'])('unavailable task evidence %s leaves authority with PostgreSQL', async code => {
  const f = fixture(); f.readTask.mockRejectedValue({ code });
  expect((await prepare(f)).ownThreadCollision).toBe(false);
  expect(f.readPid).toHaveBeenCalledTimes(1);
});

test('a changed PID file fails closed without returning an exception', async () => {
  const f = fixture(); f.readPid.mockResolvedValueOnce(identity).mockResolvedValue('');
  await expect(prepare(f)).rejects.toThrow('database_startup_identity_changed');
});

test.each(['readPid', 'readTask'])('cancellation during %s cannot return a launch environment', async operation => {
  const f = fixture(), controller = new AbortController();
  f[operation].mockImplementation(async () => { controller.abort(); return operation === 'readPid' ? identity : task; });
  await expect(prepare({ ...f, signal: controller.signal })).rejects.toThrow();
});

test('pre-cancelled and failed PID reads never inspect a task', async () => {
  const f = fixture();
  await expect(prepare({ ...f, signal: AbortSignal.abort() })).rejects.toThrow();
  expect(f.readPid).not.toHaveBeenCalled();
  f.readPid.mockRejectedValue(new Error('database_startup_identity_invalid'));
  await expect(prepare(f)).rejects.toThrow('identity_invalid');
  expect(f.readTask).not.toHaveBeenCalled();
});

function fileFixture() {
  const file = { stat: jest.fn(async () => ({ isFile: () => true, size: 0 })), close: jest.fn(async () => {}),
    read: jest.fn(async (buffer, offset) => {
      const chunk = task.slice(offset, offset + 7);
      buffer.write(chunk, offset); return { bytesRead: chunk.length };
    }) };
  return { file, openFile: jest.fn(async () => file) };
}

test('bounded kernel task reader tolerates partial reads and closes its handle', async () => {
  const f = fileFixture();
  expect(await readStartupOwnTask('157', f)).toBe(task);
  expect(f.openFile.mock.calls[0][0]).toBe('/proc/self/task/157/status');
  expect(f.file.read.mock.calls.every(([buffer]) => buffer.length === 4096)).toBe(true);
  expect(f.file.close).toHaveBeenCalledTimes(1);
});

test.each(['../157', '0', '-1', '2147483648', '157/status'])('task reader rejects non-TID paths %s before I/O', async pid => {
  const f = fileFixture(); await expect(readStartupOwnTask(pid, f)).rejects.toThrow('identity_invalid');
  expect(f.openFile).not.toHaveBeenCalled();
});

test('kernel task read rejects oversized and unsuitable files', async () => {
  const f = fileFixture();
  f.file.stat.mockResolvedValueOnce({ isFile: () => false, size: 0 });
  await expect(readStartupOwnTask('157', f)).rejects.toThrow('identity_invalid');
  expect(f.file.read).not.toHaveBeenCalled();
  f.file.read.mockResolvedValue({ bytesRead: 4096 });
  await expect(readStartupOwnTask('157', f)).rejects.toThrow('identity_invalid');
  expect(f.file.close).toHaveBeenCalledTimes(2);
});

test('cancelled kernel read closes the handle without further I/O', async () => {
  const f = fileFixture(), abort = new AbortController();
  f.openFile.mockImplementation(async () => { abort.abort(); return f.file; });
  await expect(readStartupOwnTask('157', { ...f, signal: abort.signal })).rejects.toThrow();
  expect(f.file.stat).not.toHaveBeenCalled();
  expect(f.file.close).toHaveBeenCalledTimes(1);
});
