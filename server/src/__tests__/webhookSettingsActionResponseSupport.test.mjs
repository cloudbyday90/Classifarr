/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  buildWebhookDeleteErrorResponse,
  sendWebhookSettingsErrorResponse,
  buildWebhookTestErrorResponse,
  buildWebhookTestSuccessResponse,
} from '../routes/helpers/webhookSettingsActionResponseSupport.mjs';

describe('webhookSettingsActionResponseSupport', () => {
  test('builds the success payload for test webhook responses', () => {
    expect(buildWebhookTestSuccessResponse({ ok: true })).toEqual({
      success: true,
      message: 'Test webhook sent successfully',
      response: { ok: true },
    });
  });

  test('builds the failure payload for test webhook responses', () => {
    expect(buildWebhookTestErrorResponse({
      message: 'probe failed',
      response: { data: { code: 'forbidden' } },
    })).toEqual({
      status: 500,
      body: {
        success: false,
        error: 'probe failed',
        details: { code: 'forbidden' },
      },
    });
  });

  test('builds the delete webhook failure payload with a 400 fallback', () => {
    expect(buildWebhookDeleteErrorResponse(new Error('Cannot delete the only webhook configuration'))).toEqual({
      status: 400,
      body: {
        error: 'Cannot delete the only webhook configuration',
      },
    });
  });

  test('applies the shared webhook plain-error response shape', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    sendWebhookSettingsErrorResponse(res, new Error('webhook settings failed'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'webhook settings failed' });
  });
});
