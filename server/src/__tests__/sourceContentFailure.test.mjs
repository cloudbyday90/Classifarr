/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { sourceContentFailure, sourceContentPageError, SourceContentDeferredError } from '../services/sourceContentFailure.mjs';

test.each([429, 502, 503, 504])('classifies explicit shared HTTP %s without retaining provider data', status => {
  const error = { response: { status, headers: { 'retry-after': '86400', authorization: 'synthetic-secret' }, data: 'private' } };
  const wrapped = sourceContentPageError(error, 'Page unavailable');
  expect(sourceContentFailure(wrapped)).toEqual({ reason: status === 429 ? 'rate_limited' : 'provider_unavailable',
    retryAfter: [429, 503].includes(status) ? { delayMs: 86400000 } : null });
  expect(JSON.stringify(wrapped)).not.toMatch(/synthetic-secret|private/);
  expect(wrapped.cause).toBeUndefined();
});
test.each(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'])('classifies %s', code => {
  expect(sourceContentFailure({ code })).toMatchObject({ reason: 'unreachable' });
});
test.each([{ code: 'ETIMEDOUT' }, { name: 'TimeoutError' }])('classifies timeout %j', error => {
  expect(sourceContentFailure(error)).toMatchObject({ reason: 'timeout' });
});
test.each([null, {}, new Error('503 token=secret'), { name: 'AbortError' }, { code: 'ABORT_ERR' },
  ...[400, 401, 403, 404, 500, 501, 505].map(status => ({ response: { status }, code: 'ECONNRESET' }))])('keeps non-shared evidence library-local: %j', error => {
  expect(sourceContentFailure(error)).toBeNull();
});
test('revalidates copied timing and emits only fixed safe deferred metadata', () => {
  expect(sourceContentFailure({ sourceContentFailure: { reason: 'unreachable', token: 'secret', retryAfter: { delayMs: -1, token: 'secret' } } }))
    .toEqual({ reason: 'unreachable', retryAfter: null });
  expect(sourceContentFailure(sourceContentPageError({ response: { status: 429, headers: { 'retry-after': '999999999999999' } } }, 'Unavailable')))
    .toEqual({ reason: 'rate_limited', retryAfter: { blocked: true } });
  expect(new SourceContentDeferredError()).toMatchObject({ reason: 'source_content_cooldown', retryAt: null });
});
