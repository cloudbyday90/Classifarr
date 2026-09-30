/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { omdbPacingDelay, OmdbAdmissionWaitError, OMDB_MAX_WAIT_SECONDS } from '../services/omdbPacingPolicy.mjs';
const warn = jest.fn();
jest.unstable_mockModule('../utils/logger.mjs', () => ({ createLogger: () => ({ warn }) }));
const { observeOmdbPacing } = await import('../services/omdbPacingObservation.mjs');

test.each([undefined, null, '', '-1', '1.5', '1e3', [], {}, 'tomorrow', 'x'.repeat(257), '99999999999'])
  ('rejects malformed Retry-After %j', value => {
    expect(omdbPacingDelay({ headers: { 'Retry-After': value } })).toBe(0);
  });
test('uses bounded standard waits, case insensitive names and Headers objects', () => {
  expect(omdbPacingDelay()).toBe(0);
  expect(omdbPacingDelay({ status: 429 })).toBe(60);
  expect(omdbPacingDelay({ status: 429, headers: { 'retry-after': '0' } })).toBe(60);
  expect(omdbPacingDelay({ headers: new Headers({ 'retry-after': '120' }) })).toBe(120);
  expect(omdbPacingDelay({ headers: { 'Retry-After': '9999999999' } })).toBe(OMDB_MAX_WAIT_SECONDS);
  expect(omdbPacingDelay({ headers: { 'retry-after': 'Wed, 30 Sep 2026 00:00:00 GMT' } }, Date.parse('2026-09-29'))).toBe(86400);
  expect(omdbPacingDelay({ headers: { 'retry-after': 'Wed, 30 Sep 2026 00:00:00 GMT' } }, Date.parse('2026-10-01'))).toBe(0);
  expect(omdbPacingDelay({ headers: { 'retry-after': 'Wed, 99 Sep 2026 00:00:00 GMT' } })).toBe(0);
  expect(omdbPacingDelay({ headers: { 'x-ratelimit-reset': '99999999' } })).toBe(0);
});
test('wait errors expose bounded time, not credentials or upstream text', () => {
  expect(new OmdbAdmissionWaitError(3600)).toMatchObject({ statusCode: 503, code: 'OMDB_ADMISSION_WAIT', retryAfterSeconds: 3600 });
  expect(new OmdbAdmissionWaitError(-1).retryAfterSeconds).toBe(1);
  expect(new OmdbAdmissionWaitError(999999999).retryAfterSeconds).toBe(OMDB_MAX_WAIT_SECONDS);
});
test('observations persist only timing; failures cannot replay HTTP or discard evidence', async () => {
  const persist = jest.fn(), context = { source: 'omdb', id: 1, generation: 'fixture' };
  expect(await observeOmdbPacing({}, context, persist)).toBe(0);
  expect(persist).not.toHaveBeenCalled();
  expect(await observeOmdbPacing({ headers: { 'Retry-After': '12' } }, context, persist)).toBe(12);
  expect(persist).toHaveBeenCalledWith(expect.any(Object), context, 12);
  persist.mockRejectedValue(new Error('secret'));
  expect(await observeOmdbPacing({ status: 429 }, context, persist)).toBe(60);
  expect(persist).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
});
