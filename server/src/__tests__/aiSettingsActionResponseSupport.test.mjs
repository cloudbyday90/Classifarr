/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildAiModelsErrorResponse,
  buildAiModelsSuccessResponse,
  buildAiTestConnectionErrorResponse,
  buildAiTestConnectionSuccessResponse,
} from '../routes/helpers/aiSettingsActionResponseSupport.mjs';

describe('aiSettingsActionResponseSupport', () => {
  test('buildAiTestConnectionSuccessResponse preserves the in-band probe payload', () => {
    expect(buildAiTestConnectionSuccessResponse({ success: true, message: 'ok' })).toEqual({
      status: 200,
      body: { success: true, message: 'ok' },
    });
  });

  test('buildAiTestConnectionErrorResponse preserves the 400 missing-key contract', () => {
    const error = new Error('API key is required');
    error.httpStatus = 400;

    expect(buildAiTestConnectionErrorResponse(error)).toEqual({
      status: 400,
      body: { success: false, error: 'API key is required' },
    });
  });

  test('buildAiModelsSuccessResponse preserves the stable models payload shape', () => {
    expect(buildAiModelsSuccessResponse({ success: true, models: ['gpt-5.2'] })).toEqual({
      status: 200,
      body: { success: true, models: ['gpt-5.2'] },
    });
  });

  test('buildAiModelsErrorResponse keeps in-band failures at 200 and includes empty models', () => {
    expect(buildAiModelsErrorResponse(new Error('provider unavailable'))).toEqual({
      status: 200,
      body: { success: false, error: 'provider unavailable', models: [] },
    });
  });
});
