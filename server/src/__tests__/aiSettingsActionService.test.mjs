/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createAiSettingsActionService } from '../services/aiSettingsActionService.mjs';

describe('aiSettingsActionService', () => {
  test('resetUsage delegates to cloudLLMService and returns the stable success payload', async () => {
    const cloudLLMService = {
      resetMonthlyUsage: jest.fn().mockResolvedValue(undefined),
    };
    const aiSettingsActionService = createAiSettingsActionService({ cloudLLMService });

    await expect(aiSettingsActionService.resetUsage()).resolves.toEqual({
      success: true,
      message: 'Monthly usage reset successfully',
    });
    expect(cloudLLMService.resetMonthlyUsage).toHaveBeenCalledTimes(1);
  });

  test('resetUsage propagates resetMonthlyUsage failures', async () => {
    const cloudLLMService = {
      resetMonthlyUsage: jest.fn().mockRejectedValue(new Error('reset failed')),
    };
    const aiSettingsActionService = createAiSettingsActionService({ cloudLLMService });

    await expect(aiSettingsActionService.resetUsage()).rejects.toThrow('reset failed');
  });
});