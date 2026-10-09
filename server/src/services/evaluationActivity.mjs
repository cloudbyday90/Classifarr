/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readAutomaticPolicyReport } from './automaticPolicyReplayReport.mjs';
import { ADJUDICATION_RESERVED_TOKENS } from './adjudicationBudgetContract.mjs';

const captureStates = new Set(['disabled', 'ready', 'captured', 'waiting_for_replay', 'budget_exhausted', 'deferred', 'unavailable']);
const timestamp = value => value != null && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const count = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const outcomeCounts = arm => Object.fromEntries(['automatic', 'review', 'manual', 'unavailable'].map(key => [key, arm[key]]));

function policyActivity(row, checkedAt) {
  const observedAt = timestamp(row?.observed_at);
  const empty = status => ({ status, observedAt, counts: null });
  if (!row) return empty('never_run');
  if (!observedAt) return empty('unknown');
  if (row.status === 'failed') return empty('failed');
  if (row.status !== 'complete') return empty('unknown');
  const age = Date.parse(checkedAt) - Date.parse(observedAt);
  if (age < 0 || age >= 15 * 60_000) return empty('stale');
  const report = readAutomaticPolicyReport(row.policy_report, row.sampled);
  if (!report) return empty('unknown');
  if (report.status !== 'complete') return empty(report.status);
  return { status: 'complete', observedAt, counts: { cases: report.metrics.cases, paired: report.metrics.paired,
    baseline: outcomeCounts(report.metrics.baseline), sourceAware: outcomeCounts(report.metrics.sourceAware) } };
}

function captureActivity(row) {
  const unknown = { enabled: null, dailyCalls: null, dailyTokens: null, quotaDay: null,
    callsReserved: null, tokensReserved: null, lastOutcome: 'unknown' };
  if (!row || !count(row.daily_calls, 200) || !count(row.daily_tokens, 1689600) ||
      !count(row.calls_reserved, 200) || !count(row.tokens_reserved, 1689600) ||
      row.tokens_reserved !== row.calls_reserved * ADJUDICATION_RESERVED_TOKENS || !captureStates.has(row.status) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.quota_day ?? '') ||
      timestamp(row.quota_day)?.slice(0, 10) !== row.quota_day ||
      !(row.daily_calls === 0 && row.daily_tokens === 0 || row.daily_calls > 0 && row.daily_tokens >= ADJUDICATION_RESERVED_TOKENS)) return unknown;
  return { enabled: row.daily_calls > 0, dailyCalls: row.daily_calls, dailyTokens: row.daily_tokens,
    quotaDay: row.quota_day, callsReserved: row.calls_reserved, tokensReserved: row.tokens_reserved, lastOutcome: row.status };
}

/** Counts from the latest pass are not cumulative history or a worker heartbeat. */
export function projectEvaluationActivity(policy, budget, checkedAt) {
  const checked = timestamp(checkedAt);
  if (!checked) throw new Error('evaluation_activity_clock_invalid');
  return { checkedAt: checked, policy: policyActivity(policy, checked), capture: captureActivity(budget) };
}

export async function readEvaluationActivity(client) {
  const { rows: [policy] } = await client.query(`SELECT status, observed_at::text,
    report->'policyReplay' AS policy_report, report->'sampled' AS sampled
    FROM automatic_source_pair_evaluation WHERE singleton=true`);
  const { rows: [budget] } = await client.query(`SELECT daily_calls,daily_tokens,quota_day::text,
    calls_reserved,tokens_reserved,status FROM adjudication_capture_budget WHERE singleton=true`);
  const { rows: [clock] } = await client.query('SELECT transaction_timestamp()::text AS checked_at');
  return projectEvaluationActivity(policy, budget, clock?.checked_at);
}
