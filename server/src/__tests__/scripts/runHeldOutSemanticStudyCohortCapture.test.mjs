/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import { runHeldOutSemanticStudyCohortCapture } from '../../scripts/runHeldOutSemanticStudyCohortCapture.mjs';

test('runs the private automatic cohort capture without file arguments and always closes its runtime', async () => {
  const close = jest.fn();
  const capture = { capture: jest.fn(async () => ({ status: { id: 'captured_pending_independent_labels' } })) };
  const loadRuntime = jest.fn(async () => ({ capture, close }));

  await expect(runHeldOutSemanticStudyCohortCapture({ argv: ['private.json'], loadRuntime })).rejects.toThrow('stdin_only');
  expect(loadRuntime).not.toHaveBeenCalled();
  await expect(runHeldOutSemanticStudyCohortCapture({ argv: [], loadRuntime })).resolves.toEqual({
    status: { id: 'captured_pending_independent_labels' },
  });
  expect(close).toHaveBeenCalledTimes(1);
});
