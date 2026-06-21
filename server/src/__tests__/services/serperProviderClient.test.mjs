/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  SerperProviderClient,
  buildSerperRequestHeaders,
  buildSerperSearchPayload,
} from '../../services/serperProviderClient.mjs';

describe('serperProviderClient', () => {
  test('builds token headers and bounded identity-preserving payloads', () => {
    expect(buildSerperRequestHeaders('serper-key')).toEqual({
      'X-API-KEY': 'serper-key',
    });
    expect(buildSerperSearchPayload('Mulan 1998 parents guide', {
      maxResults: 99,
      gl: 'US',
      hl: 'en-US',
    })).toEqual({
      q: 'Mulan 1998 parents guide',
      num: 20,
      autocorrect: false,
      gl: 'us',
      hl: 'en-us',
    });
  });

  test('uses POST and preserves quota response data for the error taxonomy', async () => {
    const httpPostFn = jest.fn().mockRejectedValue({
      response: {
        status: 403,
        headers: {},
        data: { message: 'Insufficient credits' },
      },
    });
    const client = new SerperProviderClient({ httpPostFn });

    await expect(client.search('test', { apiKey: 'serper-key', maxResults: 2 }))
      .rejects.toMatchObject({
        message: 'Serper.dev request failed: Insufficient credits',
        status: 403,
        response: expect.objectContaining({ status: 403 }),
      });
    expect(httpPostFn).toHaveBeenCalledWith(
      'https://google.serper.dev/search',
      expect.objectContaining({ q: 'test', num: 2, autocorrect: false }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-KEY': 'serper-key' }),
      })
    );
  });

  test('returns a bounded test result without echoing provider credentials', async () => {
    const httpPostFn = jest.fn().mockResolvedValue({ data: { organic: [] } });
    const client = new SerperProviderClient({ httpPostFn });

    await expect(client.testConnection('serper-key')).resolves.toEqual({
      success: true,
      message: 'Connection successful',
    });
  });
});
