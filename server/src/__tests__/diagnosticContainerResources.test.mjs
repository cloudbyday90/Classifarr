/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { verifyDiagnosticContainerResources, assertDiagnosticContainerRemoved } from '../scripts/diagnosticContainerResources.mjs';

const id = 'a'.repeat(64);
const expected = { memoryGiB: 1, cpuCount: 2 };
const missing = () => Object.assign(new Error('private Docker error'), { code: 1 });
const mock = () => jest.fn(async (_file, args) => ({ stdout: args[0] === 'inspect' ? '1073741824 2000000000\n' : '1073741824\n200000 100000\n' }));

test.each([[1, 2], [0.5, 1]])('verifies GiB and CPU against Docker and cgroup v2: %s / %s', async (memoryGiB, cpuCount) => {
  const execute = jest.fn(async (_file, args) => ({ stdout: args[0] === 'inspect'
    ? `${memoryGiB * 1024 ** 3} ${cpuCount * 1e9}\n` : `${memoryGiB * 1024 ** 3}\n${cpuCount * 100000} 100000\n` }));
  expect(await verifyDiagnosticContainerResources(id, { memoryGiB, cpuCount }, { execute }))
    .toEqual({ memoryBytes: memoryGiB * 1024 ** 3, cpuCount, cgroupVersion: 2 });
  expect(execute).toHaveBeenCalledTimes(2);
  for (const [file, args, options] of execute.mock.calls) {
    expect(file).toBe('docker'); expect(args).toContain(id);
    expect(options).toEqual({ timeout: 10000, maxBuffer: 4096, windowsHide: true });
    expect(args.join(' ')).not.toMatch(/Env|password|sh -c/);
  }
});

test.each(['cpu', 'cpu,cpuacct'])('supports conventional v1 %s mount', async cpuPath => {
  const execute = mock();
  execute.mockImplementation(async (_file, args) => {
    if (args[0] === 'inspect') return { stdout: '1073741824 2000000000' };
    if (!args.includes(`/sys/fs/cgroup/${cpuPath}/cpu.cfs_quota_us`)) throw missing();
    return { stdout: '1073741824\n200000\n100000\n' };
  });
  expect(await verifyDiagnosticContainerResources(id, expected, { execute })).toMatchObject({ cgroupVersion: 1 });
});

test.each([0, -1, Infinity, NaN, '1', 1024 ** 3])('rejects invalid/requested-byte memory before Docker: %s', async memoryGiB => {
  const execute = mock();
  await expect(verifyDiagnosticContainerResources(id, { memoryGiB, cpuCount: 2 }, { execute })).rejects.toThrow('request_invalid');
  expect(execute).not.toHaveBeenCalled();
});

test.each([0, 3, NaN, '2'])('rejects invalid CPU before Docker: %s', async cpuCount => {
  const execute = mock();
  await expect(verifyDiagnosticContainerResources(id, { memoryGiB: 1, cpuCount }, { execute })).rejects.toThrow('request_invalid');
  expect(execute).not.toHaveBeenCalled();
});

test.each(['classifarr', '--all', '', null])('rejects broad/non-owned selector %s', async invalid => {
  const execute = mock();
  await expect(verifyDiagnosticContainerResources(invalid, expected, { execute })).rejects.toThrow('request_invalid');
  await expect(assertDiagnosticContainerRemoved(invalid, { execute })).rejects.toThrow('id_invalid');
  expect(execute).not.toHaveBeenCalled();
});

test.each(['0 2000000000', '1073741824 0', 'private', '9'.repeat(300), '1073741824', '1e9 2e9'])('rejects malformed/unbounded Docker response: %s', async stdout => {
  const execute = mock().mockResolvedValueOnce({ stdout });
  await expect(verifyDiagnosticContainerResources(id, expected, { execute })).rejects.toThrow('limits_unverified');
  expect(execute).toHaveBeenCalledTimes(1);
});

test.each(['max\n200000 100000', '1073741824\nmax 100000', '1073741824\n200000 0', '1073741824\n-1 100000', '9007199254740992 200000 100000'])('unbounded/invalid kernel response never falls through: %s', async stdout => {
  const execute = mock().mockResolvedValueOnce({ stdout: '1073741824 2000000000' }).mockResolvedValueOnce({ stdout });
  await expect(verifyDiagnosticContainerResources(id, expected, { execute })).rejects.toThrow('limits_unverified');
  expect(execute).toHaveBeenCalledTimes(2);
});

test.each([['536870912 2000000000', '1073741824 200000 100000'], ['1073741824 1000000000', '1073741824 200000 100000'],
  ['1073741824 2000000000', '536870912 200000 100000'], ['1073741824 2000000000', '1073741824 100000 100000']])('Docker or kernel mismatch cannot pass: %s', async (docker, kernel) => {
  const execute = mock().mockResolvedValueOnce({ stdout: docker }).mockResolvedValueOnce({ stdout: kernel });
  await expect(verifyDiagnosticContainerResources(id, expected, { execute })).rejects.toThrow('limits_mismatch');
});

test('timeouts are sanitized and never trigger layout retries', async () => {
  const execute = mock().mockResolvedValueOnce({ stdout: '1073741824 2000000000' })
    .mockRejectedValueOnce(Object.assign(new Error('private'), { code: 'ETIMEDOUT' }));
  await expect(verifyDiagnosticContainerResources(id, expected, { execute })).rejects.toThrow('limits_unverified');
  expect(execute).toHaveBeenCalledTimes(2);
});

test('unsupported layouts fail after a bounded number of reads', async () => {
  const execute = mock().mockResolvedValueOnce({ stdout: '1073741824 2000000000' }).mockRejectedValue(missing());
  await expect(verifyDiagnosticContainerResources(id, expected, { execute })).rejects.toThrow('limits_unverified');
  expect(execute).toHaveBeenCalledTimes(4);
});

test('cleanup checks only the exact ID and refuses retained or unverifiable containers', async () => {
  const execute = jest.fn().mockResolvedValue({ stdout: '' });
  await assertDiagnosticContainerRemoved(id, { execute });
  expect(execute.mock.calls[0][1]).toEqual(['ps', '-aq', '--filter', `id=${id}`]);
  execute.mockResolvedValue({ stdout: id });
  await expect(assertDiagnosticContainerRemoved(id, { execute })).rejects.toThrow('cleanup_failed');
  execute.mockRejectedValue(new Error('private'));
  await expect(assertDiagnosticContainerRemoved(id, { execute })).rejects.toThrow('cleanup_unverified');
});
