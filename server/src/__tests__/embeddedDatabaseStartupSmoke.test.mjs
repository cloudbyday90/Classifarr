/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runOwnedDatabaseStartupSmoke } from '../../../scripts/check-pg-stat-startup-smoke.mjs';

test('disposable startup smoke is bounded and removes only its unique container', () => {
  const execute = jest.fn();
  runOwnedDatabaseStartupSmoke({ imageName: 'candidate:test', execute });
  const [command, args, options] = execute.mock.calls[0];
  const name = args[args.indexOf('--name') + 1];
  expect(command).toBe('docker');
  expect(name).toMatch(/^classifarr-startup-drill-[a-f0-9-]+$/);
  expect(args).toEqual(expect.arrayContaining(['--network', 'none', '--cpus', '1', '--memory', '512m', '--pids-limit', '128', '--read-only']));
  expect(args.at(-2)).toBe('candidate:test');
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

test('automatic Docker removal is tolerated without hiding daemon cleanup errors', () => {
  const execute = jest.fn().mockReturnValueOnce('').mockImplementationOnce(() => {
    throw Object.assign(new Error('removed'), { stderr: 'Error response from daemon: No such container: disposable' });
  });
  expect(() => runOwnedDatabaseStartupSmoke({ execute })).not.toThrow();
  execute.mockReset().mockReturnValueOnce('').mockImplementationOnce(() => { throw new Error('daemon unavailable'); });
  expect(() => runOwnedDatabaseStartupSmoke({ execute })).toThrow('Disposable startup container cleanup failed');
});
