/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import * as contract from '../ollamaGateway/archiveContract.mjs';

const spawn = jest.fn(), openArchiveFile = jest.fn();
jest.unstable_mockModule('node:child_process', () => ({ spawn }));
jest.unstable_mockModule('../ollamaGateway/archiveFiles.mjs', () => ({ openArchiveFile }));
jest.unstable_mockModule('../ollamaGateway/archiveContract.mjs', () => ({ ...contract, ARCHIVE_LIMIT: 32 }));
const { dumpGatewayArchive } = await import('../ollamaGateway/archiveDump.mjs');
const config = { database: { host: '/var/run/postgresql', database: 'fixture', user: 'reader' }, providerHash: 'a'.repeat(64), retentionDays: 90 };
let child, file;
const run = signal => dumpGatewayArchive(config, '00000001-00000002-1', '/private/archive', signal);
const tick = () => new Promise(resolve => { setImmediate(resolve); });
beforeEach(() => {
  child = new EventEmitter(); child.stdout = new PassThrough();
  child.kill = jest.fn(() => { child.stdout.end(); child.emit('close', null); return true; });
  spawn.mockReset().mockReturnValue(child);
  file = { writeFile: jest.fn().mockResolvedValue(undefined), sync: jest.fn().mockResolvedValue(undefined), close: jest.fn().mockResolvedValue(undefined) };
  openArchiveFile.mockReset().mockResolvedValue(file);
});
afterEach(() => { jest.useRealTimers(); });

test('streams exact bytes and syncs before reporting the digest', async () => {
  const pending = run(); await tick();
  const data = Buffer.from('PGDMPsynthetic'); child.stdout.end(data); child.emit('close', 0);
  expect(await pending).toEqual({ name: 'gateway.dump', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  expect(file.sync).toHaveBeenCalledTimes(1); expect(file.close).toHaveBeenCalledTimes(1);
  expect(spawn.mock.calls[0][0]).toBe('/usr/bin/pg_dump'); expect(spawn.mock.calls[0][2].shell).toBe(false);
});

test('already cancelled work does not open output or spawn a child', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(run(controller.signal)).rejects.toThrow(); expect(spawn).not.toHaveBeenCalled(); expect(openArchiveFile).not.toHaveBeenCalled();
});

test('cancellation kills the in-flight child and never marks its output synced', async () => {
  const controller = new AbortController(), pending = expect(run(controller.signal)).rejects.toThrow('gateway_archive_dump_failed');
  await tick(); controller.abort(); await pending;
  expect(child.kill).toHaveBeenCalledWith('SIGKILL'); expect(file.sync).not.toHaveBeenCalled(); expect(file.close).toHaveBeenCalledTimes(1);
});

test('timer kills a stalled child without retry', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  const pending = expect(run()).rejects.toThrow('gateway_archive_dump_failed'); await tick();
  await jest.advanceTimersByTimeAsync(60000); await pending;
  expect(child.kill).toHaveBeenCalledWith('SIGKILL'); expect(spawn).toHaveBeenCalledTimes(1); expect(file.close).toHaveBeenCalledTimes(1);
});

test('oversized stream is bounded before the next write', async () => {
  const pending = expect(run()).rejects.toThrow('gateway_archive_size_limit'); await tick();
  child.stdout.write(Buffer.alloc(33)); await pending;
  expect(file.writeFile).not.toHaveBeenCalled(); expect(file.sync).not.toHaveBeenCalled(); expect(child.kill).toHaveBeenCalled();
});

test.each([0, 1])('empty or unsuccessful dump is not accepted (exit %i)', async code => {
  const pending = expect(run()).rejects.toThrow('gateway_archive_dump_failed'); await tick();
  child.stdout.end(code ? 'PGDMP' : ''); child.emit('close', code); await pending;
  expect(file.sync).not.toHaveBeenCalled(); expect(file.close).toHaveBeenCalledTimes(1);
});

test.each(['writeFile', 'sync'])('filesystem failure during %s kills child and is sanitized', async method => {
  file[method].mockRejectedValue(new Error('private directory or credentials'));
  const pending = expect(run()).rejects.toThrow('gateway_archive_dump_failed'); await tick();
  child.stdout.end('PGDMPfixture'); child.emit('close', 0); await pending;
  expect(child.kill).toHaveBeenCalled(); expect(file.close).toHaveBeenCalledTimes(1);
});

test('spawn errors are sanitized and close the output file', async () => {
  const pending = expect(run()).rejects.toThrow('gateway_archive_dump_failed'); await tick();
  child.emit('error', new Error('private executable detail')); child.stdout.end(); await pending;
  expect(file.close).toHaveBeenCalledTimes(1);
});
