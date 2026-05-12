/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildSettingsErrorResponse,
  getSettingsErrorMessage,
  getSettingsErrorStatus,
} from '../routes/helpers/settingsErrorSupport.mjs';

describe('settingsErrorSupport', () => {
  test('returns the original message for normal Error instances', () => {
    expect(getSettingsErrorMessage(new Error('provider unavailable'))).toBe('provider unavailable');
  });

  test('returns a stable fallback for empty string messages', () => {
    expect(getSettingsErrorMessage({ message: '   ' })).toBe('Unknown error');
  });

  test('returns a stable fallback for malformed error objects', () => {
    expect(getSettingsErrorMessage({ httpStatus: 500 })).toBe('Unknown error');
  });

  test('returns the explicit httpStatus when present', () => {
    expect(getSettingsErrorStatus({ httpStatus: 400 }, 500)).toBe(400);
  });

  test('returns the fallback status when httpStatus is missing', () => {
    expect(getSettingsErrorStatus({}, 500)).toBe(500);
  });

  test('builds the plain Discord-style error contract for thrown errors without httpStatus', () => {
    expect(buildSettingsErrorResponse(new Error('discord lookup failed'))).toEqual({
      status: 500,
      body: {
        error: 'discord lookup failed',
      },
    });
  });

  test('preserves explicit httpStatus for operational plain-error handlers', () => {
    expect(buildSettingsErrorResponse({ httpStatus: 404, message: 'Configuration not found' })).toEqual({
      status: 404,
      body: {
        error: 'Configuration not found',
      },
    });
  });

  test('builds a stable error response with optional extras', () => {
    expect(buildSettingsErrorResponse({ httpStatus: 422, message: 'invalid sum' }, {
      extras: { currentSum: 0.4 },
    })).toEqual({
      status: 422,
      body: {
        error: 'invalid sum',
        currentSum: 0.4,
      },
    });
  });
});
