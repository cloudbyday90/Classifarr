/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildAiStatusErrorResponse,
  buildAiStatusSuccessResponse,
  buildAiUsageErrorResponse,
  buildAiUsageSuccessResponse,
} from '../routes/helpers/aiSettingsReadResponseSupport.mjs';

describe('aiSettingsReadResponseSupport', () => {
  test('buildAiUsageSuccessResponse preserves the usage payload', () => {
    expect(buildAiUsageSuccessResponse({ currentMonth: { requests: 1 } })).toEqual({
      status: 200,
      body: { currentMonth: { requests: 1 } },
    });
  });

  test('buildAiUsageErrorResponse returns the stable fallback payload when usage tables are not ready', () => {
    const tableMissing = new Error('relation "ai_usage_log" does not exist');
    tableMissing.code = '42P01';
    const fallback = { currentMonth: { requests: 0 }, recentRequests: [] };

    expect(buildAiUsageErrorResponse(tableMissing, fallback)).toEqual({
      status: 200,
      body: fallback,
    });
  });

  test('buildAiUsageErrorResponse maps unexpected usage failures to 500', () => {
    expect(buildAiUsageErrorResponse(new Error('usage query failed'))).toEqual({
      status: 500,
      body: { error: 'usage query failed' },
    });
  });

  test('buildAiStatusSuccessResponse preserves the status payload', () => {
    expect(buildAiStatusSuccessResponse({ activeProvider: 'openai', configured: true })).toEqual({
      status: 200,
      body: { activeProvider: 'openai', configured: true },
    });
  });

  test('buildAiStatusErrorResponse maps status failures to 500', () => {
    expect(buildAiStatusErrorResponse(new Error('status failed'))).toEqual({
      status: 500,
      body: { error: 'status failed' },
    });
  });

  test('buildAiStatusErrorResponse normalizes malformed errors to a stable message', () => {
    expect(buildAiStatusErrorResponse({})).toEqual({
      status: 500,
      body: { error: 'Unknown error' },
    });
  });
});
