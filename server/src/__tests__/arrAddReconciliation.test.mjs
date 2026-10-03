/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { reconcileArrAdd } from '../services/arrAddReconciliation.mjs';
import { arrAddFailure } from '../services/arrAddFailure.mjs';

const expected = { identityKey: 'tmdbId', identity: 42, rootFolderPath: '/movies' };
const item = { id: 1, tmdbId: 42, path: '/movies/Title' };

test.each([item, { ...item, path: '/other/Title' }, undefined])('verifies existing evidence before any add', async existing => {
  const read = jest.fn().mockResolvedValue(existing), add = jest.fn();
  const result = await reconcileArrAdd({ read, add, expected });
  expect(result.routed).toBe(existing === item);
  expect(read).toHaveBeenCalledTimes(1); expect(add).not.toHaveBeenCalled();
});
test('failed lookup and invalid intent cannot authorize an add or disclose raw errors', async () => {
  const read = jest.fn().mockRejectedValue(new Error('private-key-url')), add = jest.fn();
  const result = await reconcileArrAdd({ read, add, expected });
  expect(result.routed).toBe(false); expect(result.error).not.toContain('private');
  await reconcileArrAdd({ read, add, expected: { ...expected, identity: 0 } });
  expect(read).toHaveBeenCalledTimes(1); expect(add).not.toHaveBeenCalled();
});
test.each(['success', 'duplicate', 'lost-response'])('uses one read-back and no repeated POST after %s', async mode => {
  const read = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(item);
  const add = mode === 'lost-response' ? jest.fn().mockRejectedValue(new Error('private'))
    : jest.fn().mockResolvedValue(mode === 'duplicate' ? { alreadyExists: true } : item);
  const result = await reconcileArrAdd({ read, add, expected });
  expect(result).toEqual({ routed: true, reason: mode === 'success' ? 'routed' : 'already_in_arr', error: null });
  expect(read).toHaveBeenCalledTimes(2); expect(add).toHaveBeenCalledTimes(1);
});
test.each([null, undefined, { ...item, path: '/other/Title' }, { ...item, tmdbId: 99 }])
('a successful POST is not proof when read-back is %j', async observed => {
  const read = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(observed), add = jest.fn().mockResolvedValue(item);
  expect((await reconcileArrAdd({ read, add, expected })).routed).toBe(false);
  expect(add).toHaveBeenCalledTimes(1);
});
test('unavailable read-back remains unconfirmed', async () => {
  const read = jest.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('private'));
  const result = await reconcileArrAdd({ read, add: jest.fn(), expected });
  expect(result).toMatchObject({ routed: false, reason: 'arr_add_failed' });
  expect(result.error).toContain('unconfirmed'); expect(result.error).not.toContain('private');
});
test.each([400, 401, 403, 404, 422, 429])('known HTTP %s rejection is not speculative success', async status => {
  const read = jest.fn().mockResolvedValueOnce(null).mockResolvedValue(item);
  const add = jest.fn().mockRejectedValue(arrAddFailure('sonarr', { response: { status, data: 'private' } }));
  expect((await reconcileArrAdd({ read, add, expected })).routed).toBe(false);
  expect(read).toHaveBeenCalledTimes(1); expect(add).toHaveBeenCalledTimes(1);
});
test.each([undefined, 408, 409, 500, 502, 503, 504])('HTTP %s or transport failure remains ambiguous', status => {
  const error = arrAddFailure('radarr', { message: 'secret', response: { status, data: 'secret' } });
  expect(error.code).toBe('ARR_ADD_UNCERTAIN');
  expect(error.message).not.toContain('secret'); expect(error.cause).toBeUndefined(); expect(error.response).toBeUndefined();
});
