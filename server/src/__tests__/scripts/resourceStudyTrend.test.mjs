/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { summarizeStudyTrend, assertStudyTrend } from '../../scripts/resourceStudyTrend.mjs';
import { observeStudyIdle } from '../../scripts/resourceStudyIdle.mjs';
import { assertResourceStudyReceipt } from '../../scripts/resourceStudyProfiles.mjs';
import { resourceStudyReceiptFixture } from '../helpers/resourceStudyReceiptFixture.mjs';
import { formatResourceStudySummary } from '../../../../scripts/lib/resourceStudySummary.mjs';

const samples = () => ['steady', 'recovery', 'idle'].flatMap((phase, p) => Array.from({ length: 6 }, (_, i) => ({
  phase, atMs: p * 20000 + i * 2000, rssBytes: 1000 + i * 100, heapBytes: 500, externalBytes: 200,
  arrayBufferBytes: 100, containerBytes: 2000 - i * 100, completed: p < 2 ? p * 6 + i : 11,
  pending: p < 2 ? 5 - i : 0, oldestPendingSeconds: p < 2 ? i : 0, failed: 0, routing: 0,
})));

test('reports positive/negative trends, stable heap and queue throughput without claiming a leak', () => {
  const result = summarizeStudyTrend(samples(), 10000), phase = result.phases.steady;
  expect(phase.memory.rssBytes).toEqual({ earlyMedianBytes: 1050, lateMedianBytes: 1450,
    deltaBytes: 400, sampledPeakBytes: 1500, slopeBytesPerMinute: expect.closeTo(3000) });
  expect(phase.memory.containerBytes.slopeBytesPerMinute).toBeCloseTo(-3000);
  expect(phase.memory.heapBytes.slopeBytesPerMinute).toBe(0);
  expect(phase.backlog).toEqual({ peakPending: 5, oldestPendingSeconds: 5, completedDelta: 5, completionsPerSecond: 0.5 });
  expect(result.phases.idle.backlog.completedDelta).toBe(0);
  expect(JSON.stringify(result)).not.toMatch(/leak|payload|atMs/);
});

test.each([
  rows => { rows[1].atMs = rows[0].atMs; }, rows => { rows[1].atMs = -1; },
  rows => { rows[1].completed = -1; }, rows => { rows[3].completed = 0; },
  rows => { rows[1].rssBytes = null; }, rows => { rows[1].externalBytes = NaN; },
  rows => { rows[1].arrayBufferBytes = Infinity; }, rows => { rows[1].routing = 1; },
  rows => { rows[1].failed = 1; }, rows => { rows[1].phase = 'SECRET'; },
  rows => { rows[7].phase = 'steady'; }, rows => { rows[1].pending = 0.5; },
  rows => { rows[12].pending = 1; }, rows => { rows[17].completed++; },
  rows => { rows.splice(0, 2); }, rows => { rows[17].atMs--; },
])('rejects missing, reset, short or unsettled telemetry', mutate => {
  const rows = samples(); mutate(rows);
  expect(() => summarizeStudyTrend(rows, 10000)).toThrow(/resource_study_trend_/);
});

test('bounds samples and idle duration, and rejects missing summary fields', () => {
  expect(() => summarizeStudyTrend(Array(2001).fill(samples()[0]), 10000)).toThrow();
  expect(() => summarizeStudyTrend(samples(), '10000')).toThrow();
  const result = summarizeStudyTrend(samples(), 10000);
  expect(() => assertStudyTrend(result, undefined)).toThrow();
  delete result.phases.idle.memory.externalBytes;
  expect(() => assertStudyTrend(result, 10000)).toThrow();
});

function idleFixture(changes = {}) {
  let time = 0;
  const backlog = { pending: 0, failed: 0, routing: 0, completed: 20, oldestPendingSeconds: 0 };
  const options = { durationMs: 10000, now: () => time, wait: async ms => { time += ms; },
    readBacklog: async () => backlog, sample: jest.fn(async () => {}), ...changes };
  return { options, backlog, advance: ms => { time += ms; } };
}
test('idle observer checks an unchanged drained queue throughout a measured interval', async () => {
  const { options } = idleFixture();
  await observeStudyIdle(options);
  expect(options.sample).toHaveBeenCalledTimes(6);
  expect(options.now()).toBe(10000);
});
test.each(['pending', 'failed', 'routing', 'oldestPendingSeconds', 'completed'])('new idle %s activity fails', async key => {
  const { options, backlog } = idleFixture();
  options.sample.mockImplementationOnce(async () => { backlog[key]++; });
  await expect(observeStudyIdle(options)).rejects.toThrow('idle_not_settled');
});
test('a slow first query does not shorten the measured idle window', async () => {
  const fixture = idleFixture(); let first = true;
  fixture.options.readBacklog = async () => { if (first) { fixture.advance(3000); first = false; } return fixture.backlog; };
  await observeStudyIdle(fixture.options);
  expect(fixture.options.now()).toBe(13000);
});
test('missing backlog after the first sample fails closed', async () => {
  const { options, backlog } = idleFixture(); let reads = 0;
  options.readBacklog = async () => ++reads === 1 ? backlog : null;
  await expect(observeStudyIdle(options)).rejects.toThrow('idle_not_settled');
});
test('idle loop has sample and wall-time bounds and propagates sample errors', async () => {
  const frozen = idleFixture({ wait: async () => {} });
  await expect(observeStudyIdle(frozen.options)).rejects.toThrow('idle_deadline');
  const slow = idleFixture(); slow.options.wait = async () => slow.advance(50000);
  await expect(observeStudyIdle(slow.options)).rejects.toThrow('idle_deadline');
  const broken = idleFixture({ sample: async () => { throw new Error('unavailable'); } });
  await expect(observeStudyIdle(broken.options)).rejects.toThrow('unavailable');
});
test.each(['smoke', 'capacity', 'soak'])('summary is labeled, aggregate-only and validates %s evidence', mode => {
  const study = resourceStudyReceiptFixture(mode), result = { mode, budget: 'baseline', cleanup: 'passed', study, private: 'SECRET' };
  study.trend.phases.idle.private = 'SECRET';
  const markdown = formatResourceStudySummary(result);
  expect(markdown).toContain('| Phase | Scope | Early MiB');
  expect(markdown).toContain('MiB/min slope'); expect(markdown).not.toContain('SECRET');
  expect(markdown).toContain(mode === 'soak' ? '30-minute bounded workload' : 'not sustained-soak evidence');
  expect(() => formatResourceStudySummary({ ...result, cleanup: 'failed' })).toThrow();
  study.trend.phases.idle.spanMs = 1;
  expect(() => formatResourceStudySummary(result)).toThrow();
});
test('a long receipt cannot pass with short steady/recovery coverage', () => {
  const value = resourceStudyReceiptFixture('soak');
  value.trend.phases.steady.spanMs = 10000;
  expect(() => assertResourceStudyReceipt(value, 'soak')).toThrow('receipt_invalid');
});

test('summary reports finite host-default limits without calling them unlimited', () => {
  const study = resourceStudyReceiptFixture();
  study.initial.pidsLimit = study.final.pidsLimit = 19151;
  const markdown = formatResourceStudySummary({ mode: study.profile, budget: 'baseline', cleanup: 'passed', study });
  expect(markdown).toContain('Effective PID limit: **19151** (host default; no application-requested PID cap)');
  expect(markdown).not.toContain('unlimited');
});
