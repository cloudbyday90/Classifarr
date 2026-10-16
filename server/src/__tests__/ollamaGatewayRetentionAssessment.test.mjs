/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, afterEach } from '@jest/globals';
import { assessGatewayRetention, gatewayRetentionDays, RETENTION_CHECK_INTERVAL_MS as interval } from '../ollamaGateway/retentionAssessment.mjs';
import { createGatewayRetentionMonitor } from '../ollamaGateway/retentionMonitor.mjs';

const row = (count = 0, candidates = 0) => ({ reference: '0199ea26-7d80-7000-8000-000000000001',
  observed_at: new Date('2026-10-15T00:00:00.000Z'), cutoff: new Date('2026-07-17T00:00:00.000Z'),
  binding_count: count, legacy_active: false,
  categories: { active: 0, lifecycle: 0, unknown: 0, recent: count - candidates, older_terminal_review: candidates } });
const assess = (count = 0, candidates = 0) => assessGatewayRetention(row(count, candidates), 90);
afterEach(() => { jest.useRealTimers(); });

test.each([1, 90, 3650])('valid retention horizon %s', value => { expect(gatewayRetentionDays(value)).toBe(value); });
test('default horizon is assessment only', () => { expect(gatewayRetentionDays()).toBe(90); expect(assess().purgeAuthorized).toBe(false); });
test.each([0, -1, 3651, 1.5, '90', null, NaN, Infinity])('invalid horizon %s', value => {
  expect(() => gatewayRetentionDays(value)).toThrow('gateway_config_invalid');
});
test.each([
  [0, 0, 'normal', 'not_needed'], [79999, 79999, 'normal', 'not_needed'],
  [80000, 1, 'approaching', 'cleanup_needed'], [99999, 0, 'approaching', 'protected_history'],
  [100000, 1, 'full', 'cleanup_needed'], [100000, 0, 'full', 'protected_history'],
])('capacity boundary %s with %s candidates', (count, candidates, capacity, decision) => {
  expect(assess(count, candidates)).toMatchObject({ capacity, decision, bindingCount: count, candidates,
    projectedCount: count - candidates, protectedCount: count - candidates, purgeAuthorized: false });
});
test('partial cleanup does not promise enough headroom', () => {
  expect(assess(100000, 20000).sufficientHeadroom).toBe(false);
  expect(assess(100000, 20001).sufficientHeadroom).toBe(true);
});
test('legacy or inconsistent history blocks a cleanup conclusion even at low occupancy', () => {
  for (const changed of [{ ...row(1), binding_count: 0 }, { ...row(), legacy_active: true }]) {
    expect(assessGatewayRetention(changed, 90)).toMatchObject({ decision: 'assessment_blocked', projectedCount: null, sufficientHeadroom: false });
  }
});
test.each([
  { reference: 'invalid' }, { observed_at: new Date(NaN) }, { cutoff: new Date('2027-01-01') },
  { binding_count: 100001 }, { binding_count: -1 }, { binding_count: '1' }, { legacy_active: null },
  { categories: {} }, { categories: { ...row().categories, unknown: -1 } },
  { categories: { ...row().categories, unknown: 100001 } }, { categories: { ...row().categories, secret: 1 } },
])('malformed assessment is not a healthy zero %#', extra => {
  expect(() => assessGatewayRetention({ ...row(), ...extra }, 90)).toThrow('gateway_retention_unavailable');
});

test('starts without status access, repeats on a fixed delay, and status never starts reads', async () => {
  jest.useFakeTimers(); const read = jest.fn().mockResolvedValue(assess()), transition = jest.fn();
  const monitor = createGatewayRetentionMonitor({ read, onTransition: transition });
  expect(read).toHaveBeenCalledTimes(1); await jest.advanceTimersByTimeAsync(0);
  for (let n = 0; n < 100; n++) expect(monitor.status().state).toBe('available');
  expect(read).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(interval); expect(read).toHaveBeenCalledTimes(2);
  expect(transition).toHaveBeenCalledTimes(1); monitor.stop();
  await jest.advanceTimersByTimeAsync(interval * 3); expect(read).toHaveBeenCalledTimes(2);
  expect(monitor.status()).toMatchObject({ state: 'stopped', nextCheckAt: null });
});
test('slow checks never overlap or queue catch-up and shutdown fences late results', async () => {
  jest.useFakeTimers(); let finish;
  const read = jest.fn(() => new Promise(resolve => { finish = resolve; })), transition = jest.fn();
  const monitor = createGatewayRetentionMonitor({ read, onTransition: transition });
  await jest.advanceTimersByTimeAsync(interval * 5); expect(read).toHaveBeenCalledTimes(1);
  expect(monitor.status().state).toBe('pending'); monitor.stop(); finish(assess());
  await jest.advanceTimersByTimeAsync(0); expect(transition).not.toHaveBeenCalled();
  expect(monitor.status().assessment).toBeNull(); expect(jest.getTimerCount()).toBe(0);
});
test('failure preserves last evidence but reports unavailable, then recovers automatically', async () => {
  jest.useFakeTimers(); const read = jest.fn().mockResolvedValueOnce(assess()).mockRejectedValueOnce(new Error('PRIVATE token'))
    .mockResolvedValue(assess(80000, 1));
  const transition = jest.fn(), monitor = createGatewayRetentionMonitor({ read, onTransition: transition });
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(interval);
  expect(monitor.status()).toMatchObject({ state: 'unavailable', assessment: { bindingCount: 0 } });
  expect(JSON.stringify(transition.mock.calls)).not.toContain('PRIVATE');
  await jest.advanceTimersByTimeAsync(interval);
  expect(monitor.status()).toMatchObject({ state: 'available', assessment: { decision: 'cleanup_needed' } });
  expect(transition).toHaveBeenCalledTimes(3); monitor.stop();
});
test('freshness uses monotonic time, stale evidence stays visibly stale and callers cannot modify cache', async () => {
  jest.useFakeTimers(); let elapsed = 0;
  const monitor = createGatewayRetentionMonitor({ read: async () => assess(), monotonic: () => elapsed });
  await jest.advanceTimersByTimeAsync(0); monitor.status().assessment.categories.active = 99;
  expect(monitor.status().assessment.categories.active).toBe(0);
  elapsed = 2 * interval + 1; expect(monitor.status().state).toBe('stale');
  elapsed = -1; expect(monitor.status().state).toBe('stale'); monitor.stop();
});
test('logging failure cannot stop subsequent assessment and fresh starts never reuse cached evidence', async () => {
  jest.useFakeTimers(); const read = jest.fn().mockResolvedValue(assess());
  const monitor = createGatewayRetentionMonitor({ read, onTransition: () => { throw new Error('logger'); } });
  await jest.advanceTimersByTimeAsync(interval); expect(read).toHaveBeenCalledTimes(2); monitor.stop();
  const restarted = createGatewayRetentionMonitor({ read });
  expect(restarted.status()).toMatchObject({ state: 'pending', assessment: null });
  await jest.advanceTimersByTimeAsync(0); expect(read).toHaveBeenCalledTimes(3); restarted.stop();
});
test('full protected history emits a new transition; a late shutdown failure emits nothing', async () => {
  jest.useFakeTimers(); let reject;
  const read = jest.fn().mockResolvedValueOnce(assess(80000)).mockResolvedValueOnce(assess(100000))
    .mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  const onTransition = jest.fn(), monitor = createGatewayRetentionMonitor({ read, onTransition });
  await jest.advanceTimersByTimeAsync(interval); expect(onTransition).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(interval); monitor.stop(); reject(new Error('PRIVATE'));
  await jest.advanceTimersByTimeAsync(0); expect(onTransition).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});
