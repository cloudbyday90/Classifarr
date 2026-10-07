/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';

const build = jest.fn(), prepare = jest.fn(), delay = jest.fn(async () => {});
jest.unstable_mockModule('node:timers/promises', () => ({ setTimeout: delay, setImmediate: async () => {} }));
jest.unstable_mockModule('../../services/inventoryMultiScaleProfile.mjs', () => ({ buildMultiScaleProfile: build }));
jest.unstable_mockModule('../../services/inventoryMultiScaleSource.mjs', () => ({ prepareUnseenMultiScaleSource: prepare }));
const { measureColdBuilds } = await import('../../scripts/comparisonMemoryStudy/cold.mjs');

let fixture, metrics;
beforeEach(() => {
  jest.clearAllMocks();
  fixture = { identity: { dimensions: 2 }, repository: { read: jest.fn(async () => ({})) } };
  metrics = { track: jest.fn(), mark: jest.fn(), settled: jest.fn() };
  prepare.mockImplementation(() => ({ key: 'private hash', training: { vectors: new Map([['hash', [1, 0]]]) } }));
  build.mockImplementation(async () => ({ cacheable: true, weight: 100, handle: { summary: () => ({ localStatus: 'available' }) } }));
});

test('three identical cold builds release handles from results and emit only aggregates', async () => {
  expect(await measureColdBuilds({ fixture, metrics, mode: 'natural' })).toEqual({ cycles: 3, identicalSourcesAndSummaries: true });
  expect(build).toHaveBeenCalledTimes(3); expect(fixture.repository.read).toHaveBeenCalledTimes(3);
  expect(metrics.settled.mock.calls.map(([name]) => name)).toEqual(['cycle_0_idle', 'cycle_1_idle', 'cycle_2_idle']);
  expect(JSON.stringify(metrics.mark.mock.calls)).not.toContain('private hash');
  expect(delay).toHaveBeenCalledTimes(3);
});

test.each(['key', 'summary', 'weight', 'unavailable'])('rejects changed %s, not a successful matched measurement', async change => {
  if (change === 'key') prepare.mockImplementationOnce(() => ({ key: 'different', training: { vectors: new Map() } }));
  else build.mockResolvedValueOnce({ cacheable: change !== 'unavailable', weight: change === 'weight' ? 101 : 100,
    handle: { summary: () => change === 'summary' ? {} : { localStatus: 'available' } } });
  await expect(measureColdBuilds({ fixture, metrics, mode: 'natural' })).rejects.toThrow();
  expect(build.mock.calls.length).toBeLessThan(3);
});

test('unknown mode and pre-aborted work do not read or build', async () => {
  await expect(measureColdBuilds({ fixture, metrics, mode: 'bad' })).rejects.toThrow('comparison_heap_mode_invalid');
  await expect(measureColdBuilds({ fixture, metrics, mode: 'natural', signal: AbortSignal.abort() })).rejects.toThrow();
  expect(fixture.repository.read).not.toHaveBeenCalled(); expect(build).not.toHaveBeenCalled();
});

test('passes one cancellation signal into source reads and real construction', async () => {
  const controller = new AbortController();
  build.mockImplementationOnce(async () => { controller.abort(); throw controller.signal.reason; });
  await expect(measureColdBuilds({ fixture, metrics, mode: 'natural', signal: controller.signal })).rejects.toThrow();
  expect(fixture.repository.read).toHaveBeenCalledWith(fixture.identity, { requireCompleteVectors: true, signal: controller.signal });
  expect(build.mock.calls[0][1].signal).toBe(controller.signal);
  expect(delay).not.toHaveBeenCalled();
});
