/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { inspectSelectedConfiguration } from '../bootstrap/selectedConfigurationFiles.mjs';
import { selectedApplicationEnvironment } from '../bootstrap/embeddedSelectedApplication.mjs';

const identity = { uid: 1000, gid: 1000 };
const metadata = (extra = {}) => ({ uid: 1000, gid: 1000, mode: 0o100600, nlink: 1,
  dev: 1, ino: 5, mtimeMs: 2, ctimeMs: 2, isFile: () => true, ...extra });
function fixture(configuration = {}) {
  const environment = selectedApplicationEnvironment(configuration);
  const values = new Map([[environment.API_KEY_ENCRYPTION_KEY_FILE, 'ab'.repeat(32) + '\n'],
    [environment.RUNTIME_SETTINGS_FILE, '{"csrf_protection":true,"retained":"value"}']]);
  const handles = [];
  const io = {
    lstat: jest.fn(async path => ({ uid: path.startsWith('/app/data/') ? 1000 : 0, gid: path.startsWith('/app/data/') ? 1000 : 0,
      mode: 0o40700, isDirectory: () => true })),
    access: jest.fn(),
    open: jest.fn(async path => {
      if (!values.has(path)) throw Object.assign(new Error('private path'), { code: 'ENOENT' });
      const content = Buffer.from(values.get(path));
      const handle = { stat: jest.fn(async () => metadata({ size: content.length })), close: jest.fn(),
        read: jest.fn(async (buffer, offset, length, position) => ({ bytesRead: content.copy(buffer, offset, position, position + length) })) };
      handles.push(handle); return handle;
    }),
  };
  return { values, handles, io, options: { environment, identity, io } };
}

test('reads the existing key and JSON with closed handles; does not mutate configuration files', async () => {
  const f = fixture();
  expect(await inspectSelectedConfiguration(f.options)).toBe('ab'.repeat(32));
  expect(f.handles).toHaveLength(2);
  for (const handle of f.handles) expect(handle.close).toHaveBeenCalledTimes(1);
  expect(Object.keys(f.io).sort()).toEqual(['access', 'lstat', 'open']);
});
test('explicit key wins without reading or changing its ignored key file', async () => {
  const f = fixture({ API_KEY_ENCRYPTION_KEY: 'CD'.repeat(32) });
  f.values.delete(f.options.environment.API_KEY_ENCRYPTION_KEY_FILE);
  expect(await inspectSelectedConfiguration(f.options)).toBe('CD'.repeat(32));
  expect(f.io.open).toHaveBeenCalledTimes(1);
});
test('a missing default runtime JSON keeps existing first-use behavior', async () => {
  const f = fixture(); f.values.delete(f.options.environment.RUNTIME_SETTINGS_FILE);
  expect(await inspectSelectedConfiguration(f.options)).toBe('ab'.repeat(32));
});
test.each(['key_missing', 'key_invalid', 'key_oversized', 'json_invalid', 'json_array', 'json_null',
  'json_oversized', 'json_missing_custom', 'symlink_ancestor', 'foreign_owner', 'writable_ancestor',
  'wrong_directory_gid', 'permission_denied', 'file_link', 'file_special', 'key_public', 'key_foreign_group',
  'file_changed', 'close_failed'])('refuses %s with a fixed diagnostic', async failure => {
  const f = fixture(failure === 'json_missing_custom' ? { RUNTIME_SETTINGS_FILE: '/app/data/config/custom.json' } : {});
  const key = f.options.environment.API_KEY_ENCRYPTION_KEY_FILE, json = f.options.environment.RUNTIME_SETTINGS_FILE;
  if (failure === 'key_missing') f.values.delete(key);
  if (failure === 'key_invalid') f.values.set(key, 'private-invalid-key');
  if (failure === 'key_oversized') f.values.set(key, 'a'.repeat(129));
  if (failure === 'json_invalid') f.values.set(json, '{private');
  if (failure === 'json_array') f.values.set(json, '[]');
  if (failure === 'json_null') f.values.set(json, 'null');
  if (failure === 'json_oversized') f.values.set(json, ' '.repeat(1024 * 1024 + 1));
  if (failure === 'json_missing_custom') f.values.delete(json);
  if (['symlink_ancestor', 'foreign_owner', 'writable_ancestor', 'wrong_directory_gid'].includes(failure)) {
    f.io.lstat.mockResolvedValue({ uid: failure === 'foreign_owner' ? 70 : 1000,
      gid: failure === 'wrong_directory_gid' ? 70 : 1000,
      mode: failure === 'writable_ancestor' ? 0o40777 : 0o40700,
      isDirectory: () => failure !== 'symlink_ancestor' });
  }
  if (failure === 'permission_denied') f.io.access.mockRejectedValue(new Error('private filesystem error'));
  const open = f.io.open.getMockImplementation();
  f.io.open.mockImplementation(async path => {
    const handle = await open(path);
    const original = await handle.stat();
    if (failure === 'file_link') handle.stat.mockResolvedValue({ ...original, nlink: 2 });
    if (failure === 'file_special') handle.stat.mockResolvedValue({ ...original, isFile: () => false });
    if (failure === 'key_public') handle.stat.mockResolvedValue({ ...original, mode: 0o100644 });
    if (failure === 'key_foreign_group') handle.stat.mockResolvedValue({ ...original, mode: 0o100640, gid: 70 });
    if (failure === 'file_changed') handle.stat.mockResolvedValueOnce(original).mockResolvedValue({ ...original, mtimeMs: 3 });
    if (failure === 'close_failed') handle.close.mockRejectedValue(new Error('private close error'));
    return handle;
  });
  await expect(inspectSelectedConfiguration(f.options)).rejects.toThrow('selected_application_configuration_unavailable');
  for (const handle of f.handles) expect(handle.close).toHaveBeenCalled();
});
test('disabled file logging does not require access to the log directory', async () => {
  const f = fixture({ FILE_LOGGING_ENABLED: 'false' });
  await inspectSelectedConfiguration(f.options);
  expect(f.io.access.mock.calls.some(([path]) => path === f.options.environment.LOG_DIR)).toBe(false);
});
test('cancelled preflight performs no I/O', async () => {
  const f = fixture();
  await expect(inspectSelectedConfiguration({ ...f.options, signal: AbortSignal.abort() })).rejects.toThrow('database_operation_cancelled');
  expect(f.io.open).not.toHaveBeenCalled(); expect(f.io.lstat).not.toHaveBeenCalled();
});
test('cancellation during a descriptor read joins and closes before rejecting', async () => {
  const f = fixture(), controller = new AbortController();
  const open = f.io.open.getMockImplementation();
  f.io.open.mockImplementation(async path => {
    const handle = await open(path);
    handle.read.mockImplementation(async () => { controller.abort(); return { bytesRead: 0 }; });
    return handle;
  });
  await expect(inspectSelectedConfiguration({ ...f.options, signal: controller.signal })).rejects.toThrow('database_operation_cancelled');
  expect(f.handles[0].close).toHaveBeenCalledTimes(1);
});
test('unjoined I/O cannot admit application startup after the deadline', async () => {
  jest.useFakeTimers();
  try {
    const f = fixture(); f.io.open.mockImplementation(() => new Promise(() => {}));
    const run = expect(inspectSelectedConfiguration(f.options)).rejects.toThrow('database_operation_unjoined');
    await jest.advanceTimersByTimeAsync(11_001); await run;
  } finally { jest.useRealTimers(); }
});
