/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readSyncIdentityRecoveryPriority } from '../services/mediaSyncIdentityRecoveryPersistence.mjs';

const context = { libraryId: 4, mediaServerId: 9, generation: 2 };
const item = { external_id: 'source-item', source_identity_evidence: { snapshotDigest: 'digest' } };

test.each([
  [null, { attemptedAt: null }],
  [new Date(1000), { attemptedAt: 1000 }],
  ['2026-09-26T00:00:00.000Z', { attemptedAt: Date.parse('2026-09-26T00:00:00.000Z') }],
  ['invalid', null], [undefined, null], [new Date(-1), null],
])('priority normalizes persisted attempt time %s without authorizing a write', async (value, expected) => {
  const query = jest.fn().mockResolvedValue({ rows: [{ recovery_attempted_at: value }] });
  const store = { withCurrentCapture: jest.fn(async (_context, fn) => fn({ query })) };
  expect(await readSyncIdentityRecoveryPriority(store, context, item)).toEqual(expected);
  expect(store.withCurrentCapture).toHaveBeenCalledWith(context, expect.any(Function));
  expect(query).toHaveBeenCalledTimes(1);
  const [sql, values] = query.mock.calls[0];
  expect(sql).toContain('generation=$4 AND source_digest=$5');
  expect(sql).toContain('recovery_retry_after<=clock_timestamp()');
  expect(sql).toContain('AND is_active');
  expect(values).toEqual([4, 9, 'source-item', 2, 'digest']);
});

test('missing and superseded observations are ineligible', async () => {
  expect(await readSyncIdentityRecoveryPriority({ withCurrentCapture: async () => false }, context, item)).toBeNull();
  expect(await readSyncIdentityRecoveryPriority({ withCurrentCapture: async (_context, fn) => fn({ query: async () => ({ rows: [] }) }) }, context, item)).toBeNull();
});
