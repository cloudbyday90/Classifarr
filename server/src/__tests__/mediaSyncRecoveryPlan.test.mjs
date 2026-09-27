/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createMediaSyncRecoveryPlan } from '../services/mediaSyncRecoveryPlan.mjs';

test('keeps the oldest candidates across arbitrary pages with a stable key tie-break', () => {
  const plan = createMediaSyncRecoveryPlan({ limit: 3 });
  for (const [external_id, time] of [['z', 30], ['d', 20], ['c', 10], ['b', null], ['a', null]]) {
    plan.offer({ external_id }, time);
    expect(plan.size).toBeLessThanOrEqual(3);
  }
  expect(plan.offer({ external_id: 'x' }, 99)).toEqual({ admitted: false, evicted: null });
  expect(plan.drain().map(item => item.external_id)).toEqual(['a', 'b', 'c']);
  expect(plan.size).toBe(0);
  expect(plan.drain()).toEqual([]);
});

test('returns evicted snapshots and isolates retained evidence from caller mutation', () => {
  const plan = createMediaSyncRecoveryPlan({ limit: 1 });
  const item = { external_id: 'a', metadata: { title: 'original' } };
  plan.offer(item, 20); item.metadata.title = 'changed';
  expect(plan.offer({ external_id: 'b' }, 10)).toEqual({ admitted: true,
    evicted: { external_id: 'a', metadata: { title: 'original' } } });
  expect(plan.withdraw('missing')).toBeNull();
  expect(plan.withdraw('b')).toEqual({ external_id: 'b' });
  expect(plan.size).toBe(0);
});

test.each([0, -1, 33, 1.5, '8', NaN])('rejects invalid plan bound %s', limit => {
  expect(() => createMediaSyncRecoveryPlan({ limit })).toThrow('bound');
});
test.each([undefined, NaN, Infinity, -1, '123'])('rejects invalid persisted priority %s', time => {
  expect(() => createMediaSyncRecoveryPlan().offer({ external_id: 'a' }, time)).toThrow('priority');
});
test.each([null, {}, { external_id: ' ' }])('rejects missing source keys %j', item => {
  expect(() => createMediaSyncRecoveryPlan().offer(item, null)).toThrow('priority');
});
test('requires explicit withdrawal before replacing a duplicate', () => {
  const plan = createMediaSyncRecoveryPlan(); plan.offer({ external_id: 'a' }, null);
  expect(() => plan.offer({ external_id: 'a' }, null)).toThrow('Withdraw');
});
