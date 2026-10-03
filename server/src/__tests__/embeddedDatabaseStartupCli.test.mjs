/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { startEmbeddedDatabase } from '../scripts/runEmbeddedDatabaseStartup.mjs';

function fixture() {
  const processRef = Object.assign(new EventEmitter(), { env: {}, platform: 'linux',
    argv: ['node', 'startup.mjs', '--run'], getuid: () => 1000, cwd: () => '/app', stdout: { write: jest.fn() } });
  return { processRef, createProcess: jest.fn(() => ({ launch: jest.fn(), probe: jest.fn() })), start: jest.fn(async () => {}) };
}

test('configuration preflight works as root without launching any process', async () => {
  const f = fixture();
  f.processRef.getuid = () => 0;
  f.processRef.argv[2] = '--check';
  await startEmbeddedDatabase(f);
  expect(f.createProcess).not.toHaveBeenCalled();
  expect(f.start).not.toHaveBeenCalled();
});

test.each([
  { getuid: () => 0 }, { platform: 'win32' }, { cwd: () => '/tmp' },
  { argv: ['node', 'startup.mjs'] }, { argv: ['node', 'startup.mjs', '--run', 'extra'] },
  { env: { CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: 'infinite' } },
])('invalid execution context never launches a process (%j)', async change => {
  const f = fixture();
  Object.assign(f.processRef, change);
  await expect(startEmbeddedDatabase(f)).rejects.toThrow(/database_startup_(environment|timeout)_invalid/);
  expect(f.createProcess).not.toHaveBeenCalled();
});

test.each(['SIGINT', 'SIGTERM'])('%s cancels startup and removes both handlers', async event => {
  const f = fixture();
  f.start.mockImplementation(async ({ signal, report, timeoutMs }) => {
    expect(timeoutMs).toBe(300_000);
    report({ status: 'starting' });
    f.processRef.emit(event);
    expect(signal.aborted).toBe(true);
    throw new Error('cancelled');
  });
  await expect(startEmbeddedDatabase(f)).rejects.toThrow('cancelled');
  expect(f.processRef.listenerCount('SIGTERM')).toBe(0);
  expect(f.processRef.listenerCount('SIGINT')).toBe(0);
  expect(f.processRef.stdout.write.mock.calls).toEqual([['{"component":"EmbeddedDatabaseStartup","status":"starting"}\n']]);
});

test('successful startup also removes signal handlers', async () => {
  const f = fixture();
  await startEmbeddedDatabase(f);
  expect(f.start).toHaveBeenCalledTimes(1);
  expect(f.processRef.listenerCount('SIGTERM')).toBe(0);
  expect(f.processRef.listenerCount('SIGINT')).toBe(0);
});
