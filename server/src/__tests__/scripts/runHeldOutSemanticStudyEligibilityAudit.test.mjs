/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import { runHeldOutSemanticStudyEligibilityAudit } from '../../scripts/runHeldOutSemanticStudyEligibilityAudit.mjs';

test('runs the private eligibility audit without file arguments and always closes its runtime', async () => {
  const close = jest.fn();
  const audit = { audit: jest.fn(async () => ({ status: { id: 'complete' } })) };
  const loadRuntime = jest.fn(async () => ({ audit, close }));

  await expect(runHeldOutSemanticStudyEligibilityAudit({ argv: ['private.json'], loadRuntime })).rejects.toThrow('stdin_only');
  expect(loadRuntime).not.toHaveBeenCalled();
  await expect(runHeldOutSemanticStudyEligibilityAudit({ argv: [], loadRuntime })).resolves.toEqual({
    status: { id: 'complete' },
  });
  expect(close).toHaveBeenCalledTimes(1);
});
