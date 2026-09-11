/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runInventoryDescriptionComparison } from '../../scripts/runInventoryDescriptionComparison.mjs';

test.each([false, true])('always closes its database runtime (failure=%s)', async failure => {
  const runtime = { comparison: { compare: jest.fn(async () => {
    if (failure) throw new Error('failure');
    return { status: 'complete' };
  }) }, close: jest.fn() };
  const work = runInventoryDescriptionComparison({ argv: ['--size', '2'], loadRuntime: async () => runtime });
  if (failure) await expect(work).rejects.toThrow('failure');
  else expect(await work).toEqual({ status: 'complete' });
  expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(runtime.comparison.compare).toHaveBeenCalledWith(expect.objectContaining({ size: 2 }));
});

test.each([['--size', '33'], ['--seed', 'invalid'], ['--cloud'], ['filename']])('rejects invalid arguments %j before loading a provider', async argv => {
  const loadRuntime = jest.fn();
  await expect(runInventoryDescriptionComparison({ argv, loadRuntime })).rejects.toThrow();
  expect(loadRuntime).not.toHaveBeenCalled();
});
