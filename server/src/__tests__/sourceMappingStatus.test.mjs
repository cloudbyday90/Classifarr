/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceMappingStatus } from '../services/sourceMappingStatus.mjs';

const applied = new Date('2026-10-11T10:00:00Z');
test('first verification cannot become a recheck based on active ingestion alone', () => {
  expect(sourceMappingStatus({ recheck_active: true })).toEqual({ status: 'awaiting_sync', diagnostic: null, lastAppliedAt: null, recheckState: null });
});
test.each([true, false, null, undefined, 'true'])('historical application with active hint %s stays unconfirmed', recheck_active => {
  expect(sourceMappingStatus({ materialized_at: applied, recheck_active })).toEqual({
    status: 'awaiting_sync', diagnostic: null, lastAppliedAt: applied, recheckState: recheck_active === true ? 'active' : 'waiting',
  });
});
test('only a current receipt reports completion', () => {
  expect(sourceMappingStatus({ materialized_at: applied, current_receipt: true, recheck_active: true }))
    .toEqual({ status: 'materialized', diagnostic: null, lastAppliedAt: applied, recheckState: null });
});
test.each(['checking', 'deferred:source_changed', 'deferred:private'])('a library owner cannot hide an item diagnostic: %s', last_outcome => {
  expect(sourceMappingStatus({ materialized_at: applied, last_outcome, recheck_active: true })).toMatchObject({
    status: 'verification_deferred', lastAppliedAt: applied, recheckState: null,
  });
});
test('revocation wins over history, a receipt and a diagnostic', () => {
  expect(sourceMappingStatus({ revoked_at: applied, materialized_at: applied, current_receipt: true, last_outcome: 'checking', recheck_active: true }))
    .toEqual({ status: 'revoked', diagnostic: null, lastAppliedAt: applied, recheckState: null });
});
