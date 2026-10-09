/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { projectEvaluationActivity } from '../../services/evaluationActivity.mjs';
import { createAutomaticPolicyMetrics, addAutomaticPolicyMetrics, createAutomaticPolicyReport } from '../../services/automaticPolicyReplayReport.mjs';

const now = '2026-10-09T12:00:00Z';
const budget = () => ({ status: 'disabled', daily_calls: 0, daily_tokens: 0,
  quota_day: '2026-10-09', calls_reserved: 0, tokens_reserved: 0 });
function policy() {
  const metrics = createAutomaticPolicyMetrics();
  const byMedia = { movie: createAutomaticPolicyMetrics(), tv: createAutomaticPolicyMetrics() };
  for (const [type, kind] of [['movie', 'manual'], ['movie', 'manual'], ['tv', 'automatic'], ['tv', 'review']]) {
    const outcome = { kind, action: kind === 'automatic' ? 'auto_classify' : kind === 'review' ? 'prompt_confirm' : 'manual', destination: '1' };
    addAutomaticPolicyMetrics(metrics, outcome, outcome);
    addAutomaticPolicyMetrics(byMedia[type], outcome, outcome);
  }
  return { status: 'complete', observed_at: now, sampled: 4,
    policy_report: createAutomaticPolicyReport('complete', { metrics, byMedia }) };
}

test('projects completed deterministic work independently of AI capture and strips private fields', () => {
  const row = policy(); row.private = 'PRIVATE';
  const b = { ...budget(), endpoint: 'PRIVATE' };
  const result = projectEvaluationActivity(row, b, now);
  expect(result.policy).toMatchObject({ status: 'complete', counts: { cases: 4, paired: 4,
    baseline: { automatic: 1, review: 1, manual: 2, unavailable: 0 } } });
  expect(result.capture).toEqual({ enabled: false, dailyCalls: 0, dailyTokens: 0, quotaDay: '2026-10-09',
    callsReserved: 0, tokensReserved: 0, lastOutcome: 'disabled' });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|byMedia|policy_report|destination/);
});

test.each(['2026-10-09T11:45:00Z', '2026-10-09T12:00:01Z'])('hides counts from stale/future snapshots %s', at => {
  expect(projectEvaluationActivity({ ...policy(), observed_at: at }, budget(), now).policy)
    .toMatchObject({ status: 'stale', counts: null });
});

test('distinguishes missing, failed, corrupt and legacy snapshots without exposing error messages', () => {
  expect(projectEvaluationActivity(null, null, now)).toMatchObject({ policy: { status: 'never_run' }, capture: { enabled: null } });
  for (const [change, status] of [[{ status: 'failed', failure_code: 'PRIVATE' }, 'failed'],
    [{ status: 'unexpected' }, 'unknown'], [{ observed_at: 'invalid' }, 'unknown'],
    [{ policy_report: null }, 'unknown'], [{ sampled: '4' }, 'unknown'],
    [{ policy_report: { ...policy().policy_report, private: 'PRIVATE' } }, 'unknown']]) {
    const result = projectEvaluationActivity({ ...policy(), ...change }, budget(), now);
    expect(result.policy).toMatchObject({ status, counts: null });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  }
  expect(() => projectEvaluationActivity(null, null, 'bad')).toThrow('clock_invalid');
});

test.each(['no_policies', 'cache_incomplete', 'no_eligible_cases'])('keeps incomplete policy state %s', status => {
  const row = { ...policy(), policy_report: createAutomaticPolicyReport(status) };
  expect(projectEvaluationActivity(row, budget(), now).policy).toMatchObject({ status, counts: null });
});

test.each(['ready', 'captured', 'waiting_for_replay', 'budget_exhausted', 'deferred', 'unavailable'])('reports configured quota separately from saved outcome %s', status => {
  const row = { ...budget(), status, daily_calls: 5, daily_tokens: 42240, quota_day: '2026-10-08', calls_reserved: 5, tokens_reserved: 42240 };
  expect(projectEvaluationActivity(policy(), row, now).capture).toMatchObject({ enabled: true, lastOutcome: status,
    quotaDay: '2026-10-08', callsReserved: 5 });
  expect(row.calls_reserved).toBe(5); // Reading never resets yesterday's reservations.
});

test.each([{ daily_calls: -1 }, { daily_calls: '0' }, { daily_calls: 201 }, { daily_tokens: 1 },
  { daily_calls: 1 }, { daily_tokens: 1689601 }, { calls_reserved: 201 }, { calls_reserved: 1 },
  { tokens_reserved: 1 }, { quota_day: '2026-02-30' }, { quota_day: 'bad' }, { status: 'PRIVATE' }])('fails closed for invalid quota %j', change => {
  expect(projectEvaluationActivity(policy(), { ...budget(), ...change }, now).capture)
    .toEqual({ enabled: null, dailyCalls: null, dailyTokens: null, quotaDay: null,
      callsReserved: null, tokensReserved: null, lastOutcome: 'unknown' });
});
