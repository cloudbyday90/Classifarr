/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';

const spawn = jest.fn();
jest.unstable_mockModule('node:child_process', () => ({ spawn }));
const { startDrillProcess, drillRequest, waitForDrillHealth } = await import('../../scripts/restoreRecoveryProcess.mjs');
const originalFetch = globalThis.fetch;
let child;
beforeEach(() => {
  child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn(() => child.emit('exit', null));
  spawn.mockReset().mockReturnValue(child);
  globalThis.fetch = jest.fn();
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('spawns only the actual Node entrypoint and captures bounded rejection evidence', async () => {
  const process = startDrillProcess('normal', 21325);
  expect(spawn).toHaveBeenCalledWith(expect.any(String), [expect.stringMatching(/index\.mjs$/)],
    expect.objectContaining({ shell: false, env: expect.objectContaining({ CLASSIFARR_RUNTIME_MODE: 'normal', PORT: '21325' }) }));
  child.stderr.emit('data', Buffer.from('Restore verification is incomplete'));
  child.emit('exit', 1);
  await expect(process.expectRejected('Restore verification is incomplete')).resolves.toBeUndefined();
  await process.stop();
  expect(child.kill).not.toHaveBeenCalled();
});

test.each([0, 2, null])('does not accept an unrelated exit code %s as fail-closed evidence', async code => {
  const process = startDrillProcess('normal', 21325);
  child.stderr.emit('data', Buffer.from('Restore verification is incomplete'));
  child.emit('exit', code);
  await expect(process.expectRejected('Restore verification is incomplete')).rejects.toThrow('unexpected_startup_failure');
});

test('does not accept an unrelated crash or spawn failure', async () => {
  const process = startDrillProcess('normal', 21325);
  child.stderr.emit('data', Buffer.from('some other error'));
  child.emit('error', new Error('spawn unavailable'));
  await expect(process.expectRejected('Restore verification is incomplete')).rejects.toThrow('unexpected_startup_failure');
});

test('bounds child diagnostics instead of retaining unbounded output', async () => {
  const process = startDrillProcess('normal', 21325);
  child.stdout.emit('data', Buffer.from('expected-marker'));
  child.stdout.emit('data', Buffer.from('x'.repeat(20_000)));
  child.emit('exit', 1);
  await expect(process.expectRejected('expected-marker')).rejects.toThrow('unexpected_startup_failure');
});

test('interrupts only its owned child and waits for exit', async () => {
  const process = startDrillProcess('restore', 21324);
  await process.stop('SIGKILL');
  expect(child.kill).toHaveBeenCalledTimes(1);
  expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  expect(process.exited).toBe(true);
});

test('HTTP requests stay loopback, carry CSRF, reject redirects and use a deadline', async () => {
  globalThis.fetch.mockResolvedValue({ status: 200, json: async () => ({ status: 'maintenance' }),
    headers: { getSetCookie: () => ['cookie=value'] } });
  expect(await drillRequest('/api/backup/import', { body: { mode: 'replace' }, session: { 'x-csrf-token': 'synthetic' } }))
    .toEqual({ status: 200, body: { status: 'maintenance' }, cookies: ['cookie=value'] });
  expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:21324/api/backup/import',
    expect.objectContaining({ method: 'POST', redirect: 'error', signal: expect.any(AbortSignal),
      headers: expect.objectContaining({ 'x-csrf-token': 'synthetic' }) }));
});

test.each(['restore', 'normal'])('requires successful health for %s startup', async mode => {
  globalThis.fetch.mockResolvedValue({ status: 200,
    json: async () => mode === 'restore' ? { operatingMode: 'restore', workersActive: false } : { status: 'healthy' },
    headers: { getSetCookie: () => [] } });
  await expect(waitForDrillHealth({ exited: false }, mode)).resolves.toBeUndefined();
});

test('a dead process cannot pass readiness even if a different server answers', async () => {
  await expect(waitForDrillHealth({ exited: true }, 'restore')).rejects.toThrow('startup_failed:restore');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
