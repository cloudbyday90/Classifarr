/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runOwnedDatabaseStartupSmoke } from '../../../scripts/check-pg-stat-startup-smoke.mjs';

test.each([false, true])('disposable database smoke runtimeMonitor=%s is bounded and uniquely scoped', runtimeMonitor => {
  const execute = jest.fn();
  runOwnedDatabaseStartupSmoke({ imageName: 'candidate:test', execute, runtimeMonitor });
  const [command, args, options] = execute.mock.calls[0];
  const name = args[args.indexOf('--name') + 1];
  expect(command).toBe('docker');
  expect(name).toMatch(/^classifarr-startup-drill-[a-f0-9-]+$/);
  expect(args).toEqual(expect.arrayContaining(['--network', 'none', '--cpus', '1', '--memory', '512m', '--pids-limit', '128', '--read-only']));
  expect(args.at(-2)).toBe('candidate:test');
  expect(args[args.indexOf('--mount') + 1]).toContain(runtimeMonitor
    ? 'embedded-database-monitor-probe.mjs' : 'embedded-database-startup-probe.mjs');
  expect(options).toMatchObject({ timeout: 180_000, killSignal: 'SIGKILL', shell: false });
  expect(execute.mock.calls[1]).toEqual(['docker', ['rm', '-f', name],
    expect.objectContaining({ timeout: 10_000, killSignal: 'SIGKILL', shell: false })]);
});

test('timed-out Docker client still triggers cleanup and retains its failure', () => {
  const failure = new Error('timeout');
  const execute = jest.fn().mockImplementationOnce(() => { throw failure; });
  expect(() => runOwnedDatabaseStartupSmoke({ execute })).toThrow(failure);
  expect(execute.mock.calls[1][1].slice(0, 2)).toEqual(['rm', '-f']);
});

test('lifecycle I/O drill uses the same isolated harness and rejects conflicting selection', () => {
  const execute = jest.fn();
  runOwnedDatabaseStartupSmoke({ execute, lifecycleIo: true });
  const args = execute.mock.calls[0][1];
  expect(args[args.indexOf('--mount') + 1]).toContain('embedded-database-lifecycle-io-probe.mjs');
  execute.mockClear();
  expect(() => runOwnedDatabaseStartupSmoke({ execute, lifecycleIo: true, runtimeMonitor: true })).toThrow('Choose one');
  expect(execute).not.toHaveBeenCalled();
});

test('automatic Docker removal is tolerated without hiding daemon cleanup errors', () => {
  const execute = jest.fn().mockReturnValueOnce('').mockImplementationOnce(() => {
    throw Object.assign(new Error('removed'), { stderr: 'Error response from daemon: No such container: disposable' });
  });
  expect(() => runOwnedDatabaseStartupSmoke({ execute })).not.toThrow();
  execute.mockReset().mockReturnValueOnce('').mockImplementationOnce(() => { throw new Error('daemon unavailable'); });
  expect(() => runOwnedDatabaseStartupSmoke({ execute })).toThrow('Disposable startup container cleanup failed');
});
