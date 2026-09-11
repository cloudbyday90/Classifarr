/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runInventorySemanticSample } from '../../scripts/runInventorySemanticSample.mjs';

test('returns only aggregate report and closes the runtime after sampling', async () => {
  const report = { status: 'complete' };
  const runtime = { sampler: { sample: jest.fn(async () => ({ report, cases: [{ title: 'Private' }] })) }, close: jest.fn() };
  expect(await runInventorySemanticSample({ argv: ['--size', '2'], loadRuntime: async () => runtime })).toBe(report);
  expect(runtime.sampler.sample).toHaveBeenCalledWith(expect.objectContaining({ size: 2 }));
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test('closes the runtime after a database failure', async () => {
  const runtime = { sampler: { sample: jest.fn(async () => { throw new Error('failure'); }) }, close: jest.fn() };
  await expect(runInventorySemanticSample({ argv: [], loadRuntime: async () => runtime })).rejects.toThrow('failure');
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each([['--unknown'], ['--size', '0'], ['--seed', 'bad'], ['positional']])('rejects invalid arguments %j before startup', async argv => {
  const loadRuntime = jest.fn();
  await expect(runInventorySemanticSample({ argv, loadRuntime })).rejects.toThrow();
  expect(loadRuntime).not.toHaveBeenCalled();
});
