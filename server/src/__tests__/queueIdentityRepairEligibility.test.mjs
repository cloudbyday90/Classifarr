/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { ConflictError, NotFoundError } from '../utils/appError.mjs';
import { repairSourceVersion } from '../services/queueIdentityRepairContract.mjs';
const readRepairTask = jest.fn();
const requireNoRepairEffects = jest.fn();
jest.unstable_mockModule('../services/queueIdentityRepairRepository.mjs', () => ({ readRepairTask, requireNoRepairEffects }));
const { assessRepairRetry } = await import('../services/queueIdentityRepairEligibility.mjs');
const task = { id: 23, revision: '4', source_id: null, source_revision: null,
  payload: { identity_repair: 'receipt' }, media_type: 'movie', tmdb_id: 99, attempts: 1, max_attempts: 5 };
const receipt = { id: 'receipt', media_type: 'movie', old_tmdb_id: 42, new_tmdb_id: 99,
  attempts: 1, max_attempts: 5, repaired_version: repairSourceVersion(task), provider_revision: 'a' };
beforeEach(() => { readRepairTask.mockReset().mockResolvedValue(task); requireNoRepairEffects.mockReset().mockResolvedValue(); });

test('ready checks the exact original and replacement identity; omitted provider keeps individual retry contract', async () => {
  expect(await assessRepairRetry({}, '23', receipt)).toEqual({ reason: 'ready', error: null });
  expect(requireNoRepairEffects).toHaveBeenCalledWith({}, '23', 'movie', 42, 99);
});
test.each([new NotFoundError('private'), new ConflictError('private'),
  new ConflictError('private', { code: 'queue_identity_repair_conflict' })])('known failures retain write errors but project only a reason', async error => {
  readRepairTask.mockRejectedValueOnce(error);
  const result = await assessRepairRetry({}, '23', receipt);
  expect(result.error).toBe(error);
  expect(['task_missing', 'task_ineligible', 'request_changed']).toContain(result.reason);
  expect(requireNoRepairEffects).not.toHaveBeenCalled();
});
test.each([new Error('private'), new ConflictError('private', { code: 'future_unknown' }), { code: '57014' }])('unknown failures propagate rather than becoming a readiness result', async error => {
  readRepairTask.mockRejectedValueOnce(error);
  await expect(assessRepairRetry({}, '23', receipt)).rejects.toBe(error);
});
test.each([{ payload: { identity_repair: 'other' } }, { media_type: 'tv' }, { tmdb_id: 100 },
  { revision: '5' }, { source_revision: '6' }])('changed receipt binding refuses retry: %j', change => {
  readRepairTask.mockResolvedValueOnce({ ...task, ...change });
  return expect(assessRepairRetry({}, '23', receipt)).resolves.toMatchObject({ reason: 'request_changed', error: { statusCode: 409 } });
});
