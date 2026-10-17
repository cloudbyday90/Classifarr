/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const mkdir = jest.fn(), statfs = jest.fn(), archiveDirectory = jest.fn(), openArchiveFile = jest.fn();
jest.unstable_mockModule('node:fs/promises', () => ({ mkdir, statfs }));
jest.unstable_mockModule('../ollamaGateway/archiveFiles.mjs', () => ({ archiveDirectory, openArchiveFile }));
const { stageArchiveRestoreInput } = await import('../ollamaGateway/archiveRestoreInput.mjs');
const data = Buffer.from('PGDMPsynthetic-only'), dump = { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
let source, target, parts, controller;
beforeEach(() => {
  jest.resetAllMocks(); parts = [data]; controller = new AbortController();
  archiveDirectory.mockImplementation(async path => path);
  statfs.mockResolvedValue({ bavail: 1048576n, bsize: 4096n });
  source = { close: jest.fn().mockResolvedValue(), read: jest.fn(async buffer => {
    const chunk = parts.shift() ?? Buffer.alloc(0); chunk.copy(buffer); return { bytesRead: chunk.length };
  }) };
  target = { close: jest.fn().mockResolvedValue(), writeFile: jest.fn().mockResolvedValue(),
    sync: jest.fn().mockResolvedValue(), chmod: jest.fn().mockResolvedValue() };
  openArchiveFile.mockImplementation(async (_directory, _name, writing) => writing ? target : source);
});
const run = value => stageArchiveRestoreInput('/source', '/private', value ?? dump, controller.signal);

test('copies checked bytes into a private read-only file and closes both handles before returning', async () => {
  expect(await run()).toBe(join('/private', 'input', 'gateway.dump'));
  expect(mkdir).toHaveBeenCalledWith(join('/private', 'input'), { mode: 0o700 });
  expect(target.writeFile).toHaveBeenCalledWith(data); expect(target.sync).toHaveBeenCalledTimes(1);
  expect(target.chmod).toHaveBeenCalledWith(0o400);
  expect(source.close).toHaveBeenCalledTimes(1); expect(target.close).toHaveBeenCalledTimes(1);
});

test('short reads including a split PGDMP header are accepted and remain byte-exact', async () => {
  parts = [...data].map(byte => Buffer.from([byte]));
  const written = []; target.writeFile.mockImplementation(async chunk => written.push(Buffer.from(chunk)));
  await run(); expect(Buffer.concat(written)).toEqual(data);
});

test.each(['changed', 'truncated', 'grown', 'not-a-dump'])('rejects %s bytes before publishing a restore path', async kind => {
  parts = [kind === 'changed' ? Buffer.from('PGDMPwrong-content') : kind === 'truncated' ? data.subarray(0, 8) :
    kind === 'grown' ? Buffer.concat([data, Buffer.from('extra')]) : Buffer.from('WRONGsynthetic-only')];
  await expect(run()).rejects.toHaveProperty('code', 'gateway_archive_restore_mismatch');
  expect(target.chmod).not.toHaveBeenCalled(); expect(source.close).toHaveBeenCalled(); expect(target.close).toHaveBeenCalled();
});

test('admission reserves the copy plus restoration headroom before opening source or destination', async () => {
  statfs.mockResolvedValue({ bavail: 2n * BigInt(data.length) + 67108863n, bsize: 1n });
  await expect(run()).rejects.toHaveProperty('code', 'gateway_archive_scratch_full');
  expect(mkdir).not.toHaveBeenCalled(); expect(openArchiveFile).not.toHaveBeenCalled();
  statfs.mockResolvedValue({ bavail: 2n * BigInt(data.length) + 67108864n, bsize: 1n });
  await expect(run()).resolves.toBe(join('/private', 'input', 'gateway.dump'));
});

test.each(['before', 'during', 'after-copy', 'close'])('cancellation %s never returns a restore input', async point => {
  if (point === 'before') controller.abort();
  else if (point === 'during') target.writeFile.mockImplementation(async () => controller.abort());
  else if (point === 'close') source.close.mockImplementation(async () => controller.abort());
  else source.read.mockImplementation(async buffer => {
    const chunk = parts.shift();
    if (chunk) { chunk.copy(buffer); return { bytesRead: chunk.length }; }
    controller.abort(); return { bytesRead: 0 };
  });
  await expect(run()).rejects.toHaveProperty('code', 'gateway_archive_cancelled');
  if (point === 'before') expect(openArchiveFile).not.toHaveBeenCalled();
  else { expect(source.close).toHaveBeenCalled(); expect(target.close).toHaveBeenCalled(); }
});

test.each(['open', 'write', 'sync', 'mode', 'source-close', 'target-close'])('%s failure is sanitized, closes descriptors and publishes no path', async point => {
  const error = new Error('private path or secret must not escape');
  if (point === 'open') openArchiveFile.mockImplementation(async (_directory, _name, writing) => { if (writing) throw error; return source; });
  if (point === 'write') target.writeFile.mockRejectedValue(error);
  if (point === 'sync') target.sync.mockRejectedValue(error);
  if (point === 'mode') target.chmod.mockRejectedValue(error);
  if (point === 'source-close') source.close.mockRejectedValue(error);
  if (point === 'target-close') target.close.mockRejectedValue(error);
  await expect(run()).rejects.toThrow('gateway_archive_restore_input_failed');
  expect(source.close).toHaveBeenCalled(); if (point !== 'open') expect(target.close).toHaveBeenCalled();
});

test.each([null, { bytes: 268435457, sha256: dump.sha256 }, { bytes: 4, sha256: dump.sha256 },
  { bytes: 12.5, sha256: dump.sha256 }, { bytes: 12, sha256: 'invalid' }])('invalid dump contract is rejected before any allocation', async invalid => {
  await expect(stageArchiveRestoreInput('/source', '/private', invalid)).rejects.toHaveProperty('code', 'gateway_archive_restore_contract');
  expect(mkdir).not.toHaveBeenCalled(); expect(openArchiveFile).not.toHaveBeenCalled();
});
