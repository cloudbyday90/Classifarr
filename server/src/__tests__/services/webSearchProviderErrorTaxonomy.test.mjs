/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  WEB_SEARCH_PROVIDER_ERROR_CODES,
  WebSearchProviderError,
  classifyWebSearchProviderError,
  parseRetryAfterSeconds,
  sanitizeProviderErrorMessage,
  toWebSearchProviderError,
} from '../../services/webSearchProviderErrorTaxonomy.mjs';
import { WebSearchProviderContractError } from '../../services/webSearchProviderContract.mjs';
import { createTavilyWebSearchProvider } from '../../services/tavilyWebSearchProvider.mjs';

describe('webSearchProviderErrorTaxonomy', () => {
  test.each([
    [401, 'Unauthorized', WEB_SEARCH_PROVIDER_ERROR_CODES.AUTH_FAILED],
    [403, 'Forbidden', WEB_SEARCH_PROVIDER_ERROR_CODES.FORBIDDEN],
    [402, 'Payment required', WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED],
    [404, 'Not found', WEB_SEARCH_PROVIDER_ERROR_CODES.NOT_FOUND],
    [408, 'Request timeout', WEB_SEARCH_PROVIDER_ERROR_CODES.TIMEOUT],
    [422, 'Invalid query', WEB_SEARCH_PROVIDER_ERROR_CODES.INVALID_REQUEST],
    [500, 'Provider failed', WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_5XX],
    [503, 'Provider unavailable', WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_5XX],
  ])('maps HTTP %i to %s', (status, message, expectedCode) => {
    const result = classifyWebSearchProviderError({
      response: {
        status,
        data: { error: message },
      },
    }, { provider: 'example' });

    expect(result).toEqual(expect.objectContaining({
      provider: 'example',
      operation: 'search',
      errorCode: expectedCode,
      httpStatus: status,
      safeMessage: message,
    }));
  });

  test('maps 429 with retry-after as rate limited and cooldown eligible', () => {
    const result = classifyWebSearchProviderError({
      response: {
        status: 429,
        headers: { 'retry-after': '60' },
        data: { error: 'Too many requests' },
      },
    }, { provider: 'tavily' });

    expect(result).toEqual(expect.objectContaining({
      errorCode: WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
      retryable: true,
      cooldownEligible: true,
      retryAfterSeconds: 60,
    }));
  });

  test('maps quota language separately from short rate-limit bursts', () => {
    const result = classifyWebSearchProviderError({
      response: {
        status: 429,
        data: { error: 'You exceeded your monthly quota or credits' },
      },
    });

    expect(result.errorCode).toBe(WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED);
    expect(result.retryable).toBe(false);
    expect(result.cooldownEligible).toBe(true);
  });

  test.each([
    ['ETIMEDOUT', WEB_SEARCH_PROVIDER_ERROR_CODES.TIMEOUT],
    ['ECONNRESET', WEB_SEARCH_PROVIDER_ERROR_CODES.NETWORK_ERROR],
    ['ENOTFOUND', WEB_SEARCH_PROVIDER_ERROR_CODES.NETWORK_ERROR],
    ['CERT_HAS_EXPIRED', WEB_SEARCH_PROVIDER_ERROR_CODES.SSL_ERROR],
  ])('maps Node error code %s', (code, expectedCode) => {
    const result = classifyWebSearchProviderError({ code, message: 'network failure' });

    expect(result.errorCode).toBe(expectedCode);
    expect(result.cooldownEligible).toBe(true);
  });

  test('maps provider contract failures to invalid provider response', () => {
    const error = new WebSearchProviderContractError('bad response', [
      { path: ['results', 0, 'url'], code: 'invalid_format', message: 'Invalid URL' },
    ]);

    const result = classifyWebSearchProviderError(error);

    expect(result.errorCode).toBe(WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_RESPONSE_INVALID);
    expect(result.retryable).toBe(false);
  });

  test('parses retry-after seconds and HTTP dates with an upper bound', () => {
    const now = new Date('2026-06-14T00:00:00.000Z');

    expect(parseRetryAfterSeconds('30', now)).toBe(30);
    expect(parseRetryAfterSeconds('999999', now)).toBe(86400);
    expect(parseRetryAfterSeconds('Sun, 14 Jun 2026 00:01:30 GMT', now)).toBe(90);
    expect(parseRetryAfterSeconds('bad', now)).toBeNull();
  });

  test('sanitizes provider messages without preserving obvious credential values', () => {
    expect(sanitizeProviderErrorMessage('api_key=secret123 failed\u0000')).toBe('api_key=[redacted] failed');
    expect(sanitizeProviderErrorMessage('x-subscription-token: abc123 failed')).toBe('x-subscription-token=[redacted] failed');
    expect(sanitizeProviderErrorMessage('')).toBe('Provider request failed');
  });

  test('wraps classified errors in a stable WebSearchProviderError', () => {
    const wrapped = toWebSearchProviderError({
      response: {
        status: 503,
        data: { error: 'Provider unavailable' },
      },
    }, {
      provider: 'brave',
      operation: 'test_connection',
    });

    expect(wrapped).toBeInstanceOf(WebSearchProviderError);
    expect(wrapped).toEqual(expect.objectContaining({
      code: WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_5XX,
      provider: 'brave',
      operation: 'test_connection',
      httpStatus: 503,
      retryable: true,
      cooldownEligible: true,
      message: 'Provider unavailable',
    }));
  });

  test('does not rewrap an existing WebSearchProviderError', () => {
    const wrapped = toWebSearchProviderError({ code: 'ETIMEDOUT', message: 'timeout' });

    expect(toWebSearchProviderError(wrapped)).toBe(wrapped);
  });

  test('Tavily provider wrapper converts provider failures into taxonomy errors', async () => {
    const provider = createTavilyWebSearchProvider({
      tavilyService: {
        testConnection: jest.fn(),
        search: jest.fn().mockRejectedValue({
          response: {
            status: 429,
            headers: { 'retry-after': '45' },
            data: { error: 'Too many requests' },
          },
        }),
      },
    });

    await expect(provider.search({
      query: 'Office Romance parents guide',
    }, {
      apiKey: 'key',
    })).rejects.toMatchObject({
      name: 'WebSearchProviderError',
      code: WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
      provider: 'tavily',
      retryable: true,
      cooldownEligible: true,
      retryAfterSeconds: 45,
    });
  });
});
