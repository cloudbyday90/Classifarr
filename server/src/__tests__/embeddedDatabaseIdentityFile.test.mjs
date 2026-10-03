/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { constants } from 'node:fs';
import { readEmbeddedDatabaseIdentityFile } from '../bootstrap/embeddedDatabaseIdentityFile.mjs';

const text = '123\n/app/data/postgres\n1790000000\n5432\n';
function fixture() {
  const file = { stat: jest.fn(async () => ({ isFile: () => true, size: text.length })), close: jest.fn(async () => {}),
    read: jest.fn(async (buffer, offset) => {
      if (offset >= text.length) return { bytesRead: 0 };
      const chunk = text.slice(offset, offset + 7);
      buffer.write(chunk, offset);
      return { bytesRead: chunk.length };
    }) };
  return { file, openFile: jest.fn(async () => file) };
}
test('fixed path, no-follow/nonblocking flags, bounded buffer and partial reads', async () => {
  const f = fixture();
  expect(await readEmbeddedDatabaseIdentityFile(f)).toBe(text);
  expect(f.openFile).toHaveBeenCalledWith('/app/data/postgres/postmaster.pid',
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  expect(f.file.read.mock.calls.every(([buffer]) => buffer.length === 2048)).toBe(true);
  expect(f.file.close).toHaveBeenCalledTimes(1);
});
test.each([{ isFile: () => false, size: 0 }, { isFile: () => true, size: 2048 }])('rejects unsuitable file before read', async stat => {
  const f = fixture(); f.file.stat.mockResolvedValue(stat);
  await expect(readEmbeddedDatabaseIdentityFile(f)).rejects.toThrow('file_invalid');
  expect(f.file.read).not.toHaveBeenCalled();
  expect(f.file.close).toHaveBeenCalledTimes(1);
});
test('growth after stat cannot overrun the buffer', async () => {
  const f = fixture(); f.file.read.mockResolvedValue({ bytesRead: 2048 });
  await expect(readEmbeddedDatabaseIdentityFile(f)).rejects.toThrow('file_invalid');
  expect(f.file.read).toHaveBeenCalledTimes(1);
  expect(f.file.close).toHaveBeenCalledTimes(1);
});
test.each(['open', 'stat', 'read'])('cancellation after %s closes the handle and starts no further read', async stage => {
  const f = fixture(), abort = new AbortController();
  if (stage === 'open') f.openFile.mockImplementation(async () => { abort.abort(); return f.file; });
  if (stage === 'stat') f.file.stat.mockImplementation(async () => { abort.abort(); return { isFile: () => true, size: text.length }; });
  if (stage === 'read') f.file.read.mockImplementation(async () => { abort.abort(); return { bytesRead: 0 }; });
  await expect(readEmbeddedDatabaseIdentityFile({ ...f, signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.file.close).toHaveBeenCalledTimes(1);
  expect(f.file.read).toHaveBeenCalledTimes(stage === 'read' ? 1 : 0);
});
test('failed open never attempts close; failed read still closes', async () => {
  const f = fixture();
  f.openFile.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  await expect(readEmbeddedDatabaseIdentityFile(f)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(f.file.close).not.toHaveBeenCalled();
  f.file.read.mockRejectedValue(new Error('read failed'));
  await expect(readEmbeddedDatabaseIdentityFile(f)).rejects.toThrow('read failed');
  expect(f.file.close).toHaveBeenCalledTimes(1);
});
