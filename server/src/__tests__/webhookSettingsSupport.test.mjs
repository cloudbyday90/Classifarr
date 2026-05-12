/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildInvalidWebhookConfigIdResponse,
  buildMaskedWebhookConfigResponse,
  buildWebhookConfigNotFoundResponse,
  buildWebhookDeleteErrorResponse,
  buildWebhookTestErrorResponse,
  buildWebhookTestSuccessResponse,
  normalizeWebhookConfigRecordResponse,
} from '../routes/helpers/webhookSettingsSupport.mjs';

describe('webhookSettingsSupport', () => {
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

  test('builds the invalid webhook config id response', () => {
    expect(buildInvalidWebhookConfigIdResponse()).toEqual({
      status: 400,
      body: {
        error: 'Invalid configuration id',
      },
    });
  });

  test('builds the webhook config not found response', () => {
    expect(buildWebhookConfigNotFoundResponse()).toEqual({
      status: 404,
      body: {
        error: 'Configuration not found',
      },
    });
  });

  test('builds masked webhook config responses for config-by-id success paths', () => {
    const response = buildMaskedWebhookConfigResponse({
      id: 7,
      secret_key: 'whsec_liveSecret1234',
      enabled: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 7,
      enabled: true,
    });
    expect(response.body.secret_key).not.toBe('whsec_liveSecret1234');
    expect(response.body.secret_key).toContain('1234');
  });

  test('normalizes webhook config records to either a masked success or not-found response', () => {
    expect(normalizeWebhookConfigRecordResponse(null)).toEqual(buildWebhookConfigNotFoundResponse());
    expect(normalizeWebhookConfigRecordResponse({
      id: 7,
      secret_key: 'whsec_liveSecret1234',
    })).toEqual(buildMaskedWebhookConfigResponse({
      id: 7,
      secret_key: 'whsec_liveSecret1234',
    }));
  });
});
