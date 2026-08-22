/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';

import {
  LocalAiPolicySweepAuthenticationError,
  createAuthenticatedLocalAiPolicySweepApi,
} from '../../../../scripts/lib/localAiPolicySweepAuthentication.mjs';

function jsonResponse(payload, { status = 200, statusText = 'OK', headers = new Headers() } = {}) {
  return new Response(JSON.stringify(payload), { status, statusText, headers });
}

describe('local AI policy sweep API-key authentication', () => {
  test('exchanges the API key once and validates the resulting scoped token with a read-only request', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { accessToken: 'scoped-token' } }))
      .mockResolvedValueOnce(jsonResponse({ provider: 'ollama' }, {
        headers: new Headers({ etag: '"ai-settings-v1"' }),
      }));

    const authenticated = await createAuthenticatedLocalAiPolicySweepApi({
      baseUrl: 'http://localhost:21324/',
      apiKey: 'clf_test_api_key',
      fetchImpl,
    });

    expect(authenticated.authenticationMethod).toBe('api_key_exchange');
    expect(authenticated.initialAiSettingsResponse).toEqual(expect.objectContaining({
      payload: { provider: 'ollama' },
    }));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(1,
      'http://localhost:21324/api/auth/token/exchange-local-sweep',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'clf_test_api_key' }),
        body: JSON.stringify({ ttl_seconds: 300 }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(2,
      'http://localhost:21324/api/settings/ai',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer scoped-token' }),
      }),
    );
    expect(fetchImpl.mock.calls[1][1].headers).not.toHaveProperty('x-api-key');
  });

  test('does not retry a credentialed exchange when the resulting scoped token is rejected', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { accessToken: 'scoped-token' } }))
      .mockResolvedValueOnce(jsonResponse({
        error: 'This response must not be copied into the diagnostic.',
      }, { status: 403, statusText: 'Forbidden' }));

    const attempt = createAuthenticatedLocalAiPolicySweepApi({
      baseUrl: 'http://localhost:21324',
      apiKey: 'clf_test_api_key',
      fetchImpl,
    });

    await expect(attempt).rejects.toMatchObject({
      name: 'LocalAiPolicySweepAuthenticationError',
      stage: 'scoped_token_preflight',
      status: 403,
    });
    await expect(attempt).rejects.toThrow(/credentialed exchange was not retried/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('keeps token and API-key values out of exchange failure diagnostics', async () => {
    const apiKey = 'clf_secret_api_key';
    const fetchImpl = jest.fn().mockResolvedValueOnce(jsonResponse({
      error: `server saw ${apiKey}`,
    }, { status: 401, statusText: 'Unauthorized' }));

    await expect(createAuthenticatedLocalAiPolicySweepApi({
      baseUrl: 'http://localhost:21324',
      apiKey,
      fetchImpl,
    })).rejects.toBeInstanceOf(LocalAiPolicySweepAuthenticationError);

    try {
      await createAuthenticatedLocalAiPolicySweepApi({
        baseUrl: 'http://localhost:21324',
        apiKey,
        fetchImpl: jest.fn().mockResolvedValue(jsonResponse({
          error: `server saw ${apiKey}`,
        }, { status: 401, statusText: 'Unauthorized' })),
      });
    } catch (error) {
      expect(error.message).not.toContain(apiKey);
      expect(error.message).not.toContain('server saw');
    }
  });
});
