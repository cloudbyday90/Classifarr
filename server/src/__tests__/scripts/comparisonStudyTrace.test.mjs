/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { collectComparisonStudyTrace } from '../../../../scripts/lib/comparisonStudyTrace.mjs';

const line = value => `STUDY_PROGRESS ${JSON.stringify(value)}`;
test('preserves useful failure measurements without raw payloads or unknown values', () => {
  expect(collectComparisonStudyTrace(line({ phase: 'cycle_2_comparison', status: 'deferred', reason: 'memory_pressure',
    rss: 200, heapUsed: -1, pids: 2.5, message: 'private', url: 'private',
    diagnosticGc: false, alive: { snapshot: 2, unknown: 42 } }))).toEqual([
    { phase: 'cycle_2_comparison', status: 'deferred', reason: 'memory_pressure', rss: 200,
      diagnosticGc: false, alive: { snapshot: 2 } },
  ]);
});
test('rejects arbitrary phases and malformed, excessive or irrelevant input', () => {
  for (const input of [null, undefined, 'x'.repeat(8 * 1024 * 1024 + 1), 'STUDY_PROGRESS {',
    line(null), line({ phase: 'private' }), line({ phase: 'cycle_9_idle' }), 'raw log']) {
    expect(collectComparisonStudyTrace(input)).toEqual([]);
  }
  expect(collectComparisonStudyTrace(line({ phase: 'baseline', status: 'private', reason: 'private', rss: 1e100 })))
    .toEqual([{ phase: 'baseline' }]);
  expect(collectComparisonStudyTrace(line({ phase: 'baseline', padding: 'x'.repeat(16_384) }))).toEqual([]);
});
test('bounds checkpoints and preserves zero counters', () => {
  const input = Array.from({ length: 129 }, () => line({ phase: 'post_stop_idle', activeWorkers: 0, alive: { snapshot: 0 } })).join('\n');
  const trace = collectComparisonStudyTrace(input);
  expect(trace).toHaveLength(128);
  expect(trace[0]).toEqual({ phase: 'post_stop_idle', activeWorkers: 0, alive: { snapshot: 0 } });
  expect(collectComparisonStudyTrace(line({ phase: 'summary', createdWorkers: 2, exitedWorkers: 1, activeWorkers: 1,
    peaks: { arbitrary: 'private' } }))).toEqual([{ phase: 'summary', createdWorkers: 2, exitedWorkers: 1, activeWorkers: 1 }]);
});
