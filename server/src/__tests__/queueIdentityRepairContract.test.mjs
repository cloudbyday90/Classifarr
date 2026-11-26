/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { assertRepairPayload, projectRepairReceipt, repairSourceVersion, repairTaskId } from '../services/queueIdentityRepairContract.mjs';

test.each([null, undefined, {}, [23], '01', 0, -1, 2.5, Number.MAX_SAFE_INTEGER + 1, '9223372036854775808'].map(id => [id]))('rejects invalid task identifier %p', id => {
  expect(() => repairTaskId(id)).toThrow('Invalid task ID');
});
test.each([1, '99', Number.MAX_SAFE_INTEGER, '9007199254740992', '9007199254740993', '9223372036854775807'])('canonical task ID %p', id => {
  expect(repairTaskId(id)).toBe(String(id));
});
test('version captures the task and linked source, not just the media ID', () => {
  const row = { id: 1, revision: '4', source_id: 2, source_revision: '7' };
  expect(repairSourceVersion(row)).toMatch(/^[a-f0-9]{64}$/);
  for (const field of Object.keys(row)) expect(repairSourceVersion({ ...row, [field]: 'changed' })).not.toBe(repairSourceVersion(row));
});
test('allows supported unenriched requests with an unspent budget', () => {
  const row = { payload: { tmdb_id: 1, media_type: 'tv' }, source: 'manual', attempts: 1, max_attempts: 5, classification_recovery_attempts: 0 };
  expect(() => assertRepairPayload(row)).not.toThrow();
  expect(() => assertRepairPayload({ ...row, payload: null })).toThrow();
  expect(() => assertRepairPayload({ ...row, payload: [] })).toThrow();
  expect(() => assertRepairPayload({ ...row, payload: { ...row.payload, identity_repair: 'receipt' } })).toThrow();
  expect(() => assertRepairPayload({ ...row, payload: { ...row.payload, identity_repair: 'receipt' } }, true)).not.toThrow();
});
test('receipt projection excludes internal revisions and unrelated private fields', () => {
  expect(projectRepairReceipt(null)).toBeNull();
  const projected = projectRepairReceipt({ task_id: 9, id: 'receipt', old_tmdb_id: 42, new_tmdb_id: 99,
    provider_revision: 'private', source_version: 'private', secret: 'private' });
  expect(projected).toMatchObject({ taskId: '9', oldTmdbId: 42, newTmdbId: 99 });
  expect(JSON.stringify(projected)).not.toContain('private');
});
