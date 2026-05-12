/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  readWebhookConfig,
  readWebhookConfigById,
  readWebhookConfigList,
} from '../services/webhookSettingsReadService.mjs';

describe('webhookSettingsReadService', () => {
  test('reads the primary webhook config with the stored full secret applied to outbound masking', async () => {
    const webhookService = {
      getConfig: jest.fn().mockResolvedValue({
        enabled: true,
        secret_key: 'encrypted-secret',
      }),
      getFullSecret: jest.fn().mockResolvedValue('whsec_liveSecret1234'),
    };

    await expect(readWebhookConfig({ webhookService })).resolves.toEqual({
      enabled: true,
      secret_key: '••••••••1234',
    });
    expect(webhookService.getConfig).toHaveBeenCalledWith({ mask: false });
    expect(webhookService.getFullSecret).toHaveBeenCalledTimes(1);
  });

  test('passes list and by-id reads through to the webhook service', async () => {
    const webhookService = {
      getAllConfigs: jest.fn().mockResolvedValue([{ id: 1, name: 'Primary' }]),
      getConfigById: jest.fn().mockResolvedValue({ id: 7, name: 'Secondary' }),
    };

    await expect(readWebhookConfigList({ webhookService })).resolves.toEqual([{ id: 1, name: 'Primary' }]);
    await expect(readWebhookConfigById({ webhookService, id: 7 })).resolves.toEqual({ id: 7, name: 'Secondary' });
    expect(webhookService.getAllConfigs).toHaveBeenCalledTimes(1);
    expect(webhookService.getConfigById).toHaveBeenCalledWith(7);
  });
});