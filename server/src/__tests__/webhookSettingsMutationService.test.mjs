/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createWebhookSettingsMutationService } from '../services/webhookSettingsMutationService.mjs';

describe('webhookSettingsMutationService', () => {
  test('updates the primary webhook config through normalization, persistence, and outbound masking', async () => {
    const webhookService = {
      updateConfig: jest.fn().mockResolvedValue({ enabled: true, secret_key: 'encrypted' }),
      getFullSecret: jest.fn().mockResolvedValue('whsec_liveSecret1234'),
    };
    const normalizeWebhookConfigUpdatePayload = jest.fn().mockResolvedValue({
      enabled: true,
      secret_key: 'whsec_liveSecret1234',
    });
    const maskWebhookSecret = jest.fn().mockReturnValue({
      enabled: true,
      secret_key: '••••••••1234',
    });
    const annotateWebhookSecretStatus = jest.fn().mockReturnValue({
      enabled: true,
      secret_key: '••••••••1234',
      secret_key_status: 'available',
    });
    const mutationService = createWebhookSettingsMutationService({
      webhookService,
      annotateWebhookSecretStatus,
      normalizeWebhookConfigUpdatePayload,
      maskWebhookSecret,
    });

    await expect(mutationService.updateConfig({
      body: { enabled: true, secret_key: '••••••••1234' },
    })).resolves.toEqual({
      enabled: true,
      secret_key: '••••••••1234',
      secret_key_status: 'available',
    });
    expect(webhookService.updateConfig).toHaveBeenCalledWith({
      enabled: true,
      secret_key: 'whsec_liveSecret1234',
    });
    expect(maskWebhookSecret).toHaveBeenCalledWith(
      { enabled: true, secret_key: 'encrypted' },
      'whsec_liveSecret1234',
    );
    expect(annotateWebhookSecretStatus).toHaveBeenCalledWith(
      { enabled: true, secret_key: '••••••••1234' },
      'whsec_liveSecret1234',
    );
  });

  test('creates and updates secondary configs through the create normalizer and preserves the primary mutation path', async () => {
    const webhookService = {
      createConfig: jest.fn().mockResolvedValue({ id: 8, name: 'Secondary' }),
      updateConfigById: jest.fn().mockResolvedValue({ id: 8, name: 'Secondary' }),
      setPrimaryConfig: jest.fn().mockResolvedValue({ id: 8, is_primary: true }),
      generateSecretKey: jest.fn().mockReturnValue('whsec_generatedSecret'),
      updateConfig: jest.fn().mockResolvedValue({ enabled: true }),
    };
    const normalizeWebhookCreatePayload = jest.fn((payload) => ({ ...payload }));
    const mutationService = createWebhookSettingsMutationService({
      webhookService,
      normalizeWebhookCreatePayload,
    });

    await expect(mutationService.createConfig({ body: { name: 'Secondary' } })).resolves.toEqual({ id: 8, name: 'Secondary' });
    await expect(mutationService.updateConfigById({ id: 8, body: { name: 'Secondary' } })).resolves.toEqual({ id: 8, name: 'Secondary' });
    await expect(mutationService.setPrimaryConfig({ id: 8 })).resolves.toEqual({ id: 8, is_primary: true });
    await expect(mutationService.generateKey()).resolves.toEqual({
      enabled: true,
      secret_key: 'whsec_generatedSecret',
      secret_key_status: 'available',
    });

    expect(webhookService.createConfig).toHaveBeenCalledWith({ name: 'Secondary' });
    expect(webhookService.updateConfigById).toHaveBeenCalledWith(8, { name: 'Secondary' });
    expect(webhookService.setPrimaryConfig).toHaveBeenCalledWith(8);
    expect(webhookService.updateConfig).toHaveBeenCalledWith({ secret_key: 'whsec_generatedSecret' });
  });

  test('throws a 400 error when a webhook config create request omits name', async () => {
    const mutationService = createWebhookSettingsMutationService({
      webhookService: {
        createConfig: jest.fn(),
      },
    });

    await expect(mutationService.createConfig({ body: {} })).rejects.toMatchObject({
      httpStatus: 400,
      message: 'Name is required',
    });
  });
});
