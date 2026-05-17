/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createWebhookSettingsActionService } from '../services/webhookSettingsActionService.mjs';

describe('webhookSettingsActionService', () => {
  test('reads the secret, builds the URL, and posts the stable test payload', async () => {
    const webhookService = {
      getConfig: jest.fn().mockResolvedValue({ secret_key: 'encrypted' }),
      getFullSecret: jest.fn().mockResolvedValue('whsec_liveSecret1234'),
    };
    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { ok: true } }),
    };
    const buildWebhookUrl = jest.fn().mockReturnValue('https://example.test/api/webhook/overseerr?key=whsec_liveSecret1234');
    const actionService = createWebhookSettingsActionService({
      webhookService,
      httpClient,
      buildWebhookUrl,
    });

    await expect(actionService.getSecret()).resolves.toEqual({ secret_key: 'whsec_liveSecret1234' });
    await expect(actionService.getUrl({ req: { protocol: 'https' } })).resolves.toEqual({
      url: 'https://example.test/api/webhook/overseerr?key=whsec_liveSecret1234',
    });
    await expect(actionService.sendTestWebhook({ req: { protocol: 'https' } })).resolves.toEqual({ ok: true });

    expect(buildWebhookUrl).toHaveBeenNthCalledWith(1, { protocol: 'https' }, 'whsec_liveSecret1234');
    expect(buildWebhookUrl).toHaveBeenNthCalledWith(2, { protocol: 'https' }, 'whsec_liveSecret1234');
    expect(httpClient.post).toHaveBeenCalledWith(
      'https://example.test/api/webhook/overseerr?key=whsec_liveSecret1234',
      expect.objectContaining({
        notification_type: 'TEST_NOTIFICATION',
        event: 'test',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Classifarr-Test',
        },
      },
    );
  });

  test('throws a 404 error when no webhook secret is configured', async () => {
    const actionService = createWebhookSettingsActionService({
      webhookService: {
        getConfig: jest.fn().mockResolvedValue({ secret_key: null }),
        getFullSecret: jest.fn().mockResolvedValue(null),
      },
      httpClient: {
        post: jest.fn(),
      },
      buildWebhookUrl: jest.fn(),
    });

    await expect(actionService.getSecret()).rejects.toMatchObject({
      httpStatus: 404,
      message: 'No webhook secret configured',
    });
  });

  test('throws a 409 error when a stored webhook secret exists but is not decryptable', async () => {
    const actionService = createWebhookSettingsActionService({
      webhookService: {
        getConfig: jest.fn().mockResolvedValue({ secret_key: 'encrypted' }),
        getFullSecret: jest.fn().mockResolvedValue(null),
      },
      httpClient: {
        post: jest.fn(),
      },
      buildWebhookUrl: jest.fn(),
    });

    await expect(actionService.getSecret()).rejects.toMatchObject({
      httpStatus: 409,
      message: expect.stringContaining('stored encryption key no longer matches'),
    });
  });
});
