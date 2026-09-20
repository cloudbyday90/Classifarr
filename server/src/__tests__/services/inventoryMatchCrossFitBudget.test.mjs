/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import * as kernel from '../../services/libraryMatchCrossFit.mjs';
import { matchCalibrationFixture } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

// Scale only the reservation limit in this isolated test; exercise the real numeric kernel.
const fit = jest.fn(kernel.fitLibraryMatchCrossFit);
jest.unstable_mockModule('../../services/libraryMatchCrossFit.mjs', () => ({ ...kernel,
  fitLibraryMatchCrossFit: fit,
  LIBRARY_MATCH_CROSS_FIT_LIMITS: { ...kernel.LIBRARY_MATCH_CROSS_FIT_LIMITS, modelVectorComponents: 500 },
}));
const { createInventoryMatchCalibration } = await import('../../services/inventoryMatchCalibration.mjs');

test('failed fits release reservations; cached fits do not charge again; additional folds hit the memory bound', async () => {
  const input = matchCalibrationFixture(), session = createInventoryMatchCalibration(input, { crossFit: true });
  fit.mockRejectedValueOnce(new Error('cancelled'));
  await expect(session.assess(input.entry)).rejects.toThrow('cancelled');
  const first = await session.assess(input.entry); // 238 retained components.
  const calls = fit.mock.calls.length;
  expect(await session.assess(input.entry)).toEqual(first);
  expect(fit).toHaveBeenCalledTimes(calls);
  await session.assess({ ...input.entry, heldDescriptionHashes: new Set([input.entry.descriptionHash, input.documents[1].hash]) });
  await expect(session.assess({ ...input.entry,
    heldDescriptionHashes: new Set([input.entry.descriptionHash, input.documents[2].hash]) })).rejects.toThrow('model_memory_budget');
  expect(await session.assess(input.entry)).toEqual(first);
});
