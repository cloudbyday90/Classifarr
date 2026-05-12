/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  buildWebhookUrl,
  isMaskedWebhookSecret,
  maskWebhookSecret,
  normalizeWebhookConfigUpdatePayload,
  normalizeWebhookCreatePayload,
} from '../services/shared/webhookSettingsModel.mjs';

describe('webhookSettingsModel', () => {
  test('detects and masks webhook secrets without mutating the source record', () => {
    const record = {
      id: 7,
      secret_key: 'whsec_liveSecret1234',
    };

    expect(isMaskedWebhookSecret('••••••••1234')).toBe(true);
    expect(isMaskedWebhookSecret('whsec_liveSecret1234')).toBe(false);

    const masked = maskWebhookSecret(record, 'whsec_liveSecret1234');

    expect(masked).not.toBe(record);
    expect(masked.secret_key).toContain('1234');
    expect(record.secret_key).toBe('whsec_liveSecret1234');
  });

  test('builds webhook URLs with or without a secret key', () => {
    const req = {
      protocol: 'https',
      get: jest.fn().mockReturnValue('example.test'),
    };

    expect(buildWebhookUrl(req, 'whsec_liveSecret1234')).toBe(
      'https://example.test/api/webhook/overseerr?key=whsec_liveSecret1234'
    );
    expect(buildWebhookUrl(req, null)).toBe('https://example.test/api/webhook/overseerr');
  });

  test('normalizes webhook update payloads by restoring or clearing masked secrets', async () => {
    const webhookService = {
      getFullSecret: jest.fn()
        .mockResolvedValueOnce('whsec_liveSecret1234')
        .mockResolvedValueOnce(null),
    };

    await expect(normalizeWebhookConfigUpdatePayload({
      payload: { enabled: true, secret_key: '••••••••1234' },
      webhookService,
    })).resolves.toEqual({
      enabled: true,
      secret_key: 'whsec_liveSecret1234',
    });

    await expect(normalizeWebhookConfigUpdatePayload({
      payload: { enabled: true, secret_key: '••••••••9999' },
      webhookService,
    })).resolves.toEqual({
      enabled: true,
    });
  });

  test('normalizes webhook create payloads by dropping masked secrets only', () => {
    expect(normalizeWebhookCreatePayload({
      name: 'Jellyseerr',
      secret_key: '••••••••1234',
      enabled: true,
    })).toEqual({
      name: 'Jellyseerr',
      enabled: true,
    });

    expect(normalizeWebhookCreatePayload({
      name: 'Jellyseerr',
      secret_key: 'whsec_liveSecret1234',
      enabled: true,
    })).toEqual({
      name: 'Jellyseerr',
      secret_key: 'whsec_liveSecret1234',
      enabled: true,
    });
  });
});