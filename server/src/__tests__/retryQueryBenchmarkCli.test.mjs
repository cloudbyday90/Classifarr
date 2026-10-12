/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
let builder, measurementFailure;
const id = 'b'.repeat(64), stop = jest.fn(), verify = jest.fn(), removed = jest.fn(), measure = jest.fn();
jest.unstable_mockModule('@testcontainers/postgresql', () => ({ PostgreSqlContainer: class {
  constructor(image) { this.image = image; builder = this; }
  withDatabase(value) { this.database = value; return this; }
  withUsername() { return this; }
  withPassword() { return this; }
  withResourcesQuota(value) { this.quota = value; return this; }
  async start() { return this; }
  getId() { return id; }
  stop() { return stop(); }
} }));
jest.unstable_mockModule('../scripts/diagnosticContainerResources.mjs', () => ({
  verifyDiagnosticContainerResources: verify, assertDiagnosticContainerRemoved: removed,
}));
jest.unstable_mockModule('../scripts/runLibraryScanRecoveryBenchmark.mjs', () => ({
  runLibraryScanRecoveryBenchmark: async options => {
    const container = await options.start('synthetic-password');
    try { measure(); if (measurementFailure) throw measurementFailure; return { passed: true }; }
    finally { await container.stop(); }
  },
}));
const { runRetryQueryBenchmark } = await import('../scripts/runRetryQueryBenchmark.mjs');
beforeEach(() => {
  for (const mock of [stop, verify, removed, measure]) mock.mockReset();
  measurementFailure = null;
  verify.mockResolvedValue({ memoryBytes: 1024 ** 3, cpuCount: 2, cgroupVersion: 2 });
});

test('uses GiB, verifies before measurements, and independently proves cleanup', async () => {
  expect(await runRetryQueryBenchmark({ argv: [] })).toMatchObject({ passed: true, resources: { memoryBytes: 1024 ** 3 } });
  expect(builder.quota).toEqual({ memory: 1, cpu: 2 });
  expect(verify).toHaveBeenCalledWith(id, { memoryGiB: 1, cpuCount: 2 });
  expect(verify.mock.invocationCallOrder[0]).toBeLessThan(measure.mock.invocationCallOrder[0]);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(removed).toHaveBeenCalledWith(id);
});
test('verification refusal stops the owned container without admitting work', async () => {
  verify.mockRejectedValue(new Error('limits_unverified'));
  await expect(runRetryQueryBenchmark({ argv: [] })).rejects.toThrow('limits_unverified');
  expect(measure).not.toHaveBeenCalled(); expect(stop).toHaveBeenCalledTimes(1); expect(removed).toHaveBeenCalledWith(id);
});
test('measurement failure still verifies removal', async () => {
  measurementFailure = new Error('measurement');
  await expect(runRetryQueryBenchmark({ argv: [] })).rejects.toBe(measurementFailure);
  expect(stop).toHaveBeenCalledTimes(1); expect(removed).toHaveBeenCalledWith(id);
});
test('cleanup refusal cannot return successful evidence', async () => {
  removed.mockRejectedValue(new Error('cleanup_failed'));
  await expect(runRetryQueryBenchmark({ argv: [] })).rejects.toThrow('cleanup_failed');
});
test('a stop failure still checks whether the exact owned container remains', async () => {
  stop.mockRejectedValue(new Error('stop_failed'));
  await expect(runRetryQueryBenchmark({ argv: [] })).rejects.toThrow('stop_failed');
  expect(removed).toHaveBeenCalledWith(id);
});
