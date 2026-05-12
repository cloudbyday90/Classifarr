/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import { getAiSettingsErrorMessage } from '../routes/helpers/aiSettingsErrorSupport.mjs';

describe('aiSettingsErrorSupport', () => {
  test('returns the original message for normal Error instances', () => {
    expect(getAiSettingsErrorMessage(new Error('provider unavailable'))).toBe('provider unavailable');
  });

  test('returns a stable fallback for empty string messages', () => {
    expect(getAiSettingsErrorMessage({ message: '   ' })).toBe('Unknown error');
  });

  test('returns a stable fallback for malformed error objects', () => {
    expect(getAiSettingsErrorMessage({ httpStatus: 500 })).toBe('Unknown error');
  });
});
