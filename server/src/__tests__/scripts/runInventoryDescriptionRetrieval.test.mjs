/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runInventoryDescriptionRetrieval } from '../../scripts/runInventoryDescriptionRetrieval.mjs';

test('parses the bounded initial-build budget and closes the runtime', async () => {
  const runtime = { retrieval: { run: jest.fn(async () => ({ status: 'warming_cache' })) }, close: jest.fn() };
  expect(await runInventoryDescriptionRetrieval({ argv: ['--max-new-descriptions', '1024'], loadRuntime: async () => runtime })).toEqual({ status: 'warming_cache' });
  expect(runtime.retrieval.run).toHaveBeenCalledWith(expect.objectContaining({ size: 24 }), expect.objectContaining({ maxNewDescriptions: 1024 }));
  expect(runtime.close).toHaveBeenCalledTimes(1);
  runtime.retrieval.run.mockRejectedValue(new Error('offline'));
  await expect(runInventoryDescriptionRetrieval({ argv: [], loadRuntime: async () => runtime })).rejects.toThrow('offline');
  expect(runtime.close).toHaveBeenCalledTimes(2);
});

test('rejects unsupported input before loading configuration or starting inference', async () => {
  const loadRuntime = jest.fn();
  for (const argv of [['--max-new-descriptions', '10001'], ['--size', '0'], ['--url', 'https://example.com']]) {
    await expect(runInventoryDescriptionRetrieval({ argv, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
});
