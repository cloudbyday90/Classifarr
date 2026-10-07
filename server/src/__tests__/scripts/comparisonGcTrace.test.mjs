/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { collectComparisonGcTrace } from '../../../../scripts/lib/comparisonGcTrace.mjs';

const gc = (time = 100, pool = 340, flags = '') =>
  `[123:0xabcdef] ${time} ms: Mark-Compact${flags} 580.3 (650.4) -> 219.0 (384.1) MB, pooled: ${pool} MB, 6.86 / 0.00 ms PRIVATE cause`;
const phase = (name, elapsedMs) => `STUDY_PROGRESS ${JSON.stringify({ phase: name, elapsedMs, secret: 'PRIVATE' })}`;

test('collects local page-pool evidence and output-order phase brackets without raw identity or cause', () => {
  const result = collectComparisonGcTrace([gc(1, 0), phase('catalog_drained', 80), gc(),
    'PRIVATE provider body', phase('recovery_comparison', 120), gc(200, 0, ' (reduce) (interleaved)')].join('\n'));
  expect(result).toMatchObject({ version: 1, status: 'complete', rejected: 0, truncated: false });
  expect(result.events).toHaveLength(3);
  expect(result.events[1]).toEqual({ source: 1, clockReset: false, elapsedMs: 100, reduceMemory: false, interleaved: false,
    heapBeforeMiB: 580.3, committedBeforeMiB: 650.4, heapAfterMiB: 219, committedAfterMiB: 384.1,
    pooledMiB: 340, pauseMs: 6.86, externalPauseMs: 0,
    after: { phase: 'catalog_drained', elapsedMs: 80 }, before: { phase: 'recovery_comparison', elapsedMs: 120 } });
  expect(result.events[0].after).toBeNull();
  expect(result.events[2]).toMatchObject({ reduceMemory: true, interleaved: true, pooledMiB: 0, before: null });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|abcdef|cause|pid|isolate/);
});

test.each([null, '', 'PRIVATE', 'x'.repeat(8 * 1024 * 1024 + 1)])('missing/oversized evidence is not zero-pool success (%#)', input => {
  expect(collectComparisonGcTrace(input).status).toBe('unavailable');
});

test.each([
  gc().replace('340 MB', '-1 MB'), gc().replace('340 MB', 'NaN MB'), gc().replace('340 MB', '1e9 MB'),
  gc().replace('340 MB', '9007199254740992 MB'), gc().replace('Mark-Compact', 'Changed-Format'),
  gc().replace(' (384.1)', ' (10.0)'), gc() + 'x'.repeat(4096), gc().replace('pooled: 340 MB, ', ''),
])('malformed GC telemetry stays explicit and never hides behind a valid event (%#)', line => {
  const result = collectComparisonGcTrace(`${gc(1)}\n${line}`);
  expect(result.status).toBe('partial'); expect(result.rejected).toBe(1); expect(result.events).toHaveLength(1);
});

test('multiple sources remain separate and clock regression flags possible address reuse', () => {
  const result = collectComparisonGcTrace([gc(), gc(99), gc(101).replace('abcdef', 'deadbeef')].join('\n'));
  expect(result.status).toBe('complete');
  expect(result.events.map(({ source, clockReset }) => ({ source, clockReset }))).toEqual([
    { source: 1, clockReset: false }, { source: 1, clockReset: true }, { source: 2, clockReset: false },
  ]);
  expect(JSON.stringify(result)).not.toMatch(/abcdef|deadbeef/);
});

test('a different process cannot be silently combined with the study process', () => {
  expect(collectComparisonGcTrace(`${gc()}\n${gc(101).replace('123:', '456:')}`)).toMatchObject({ status: 'partial', rejected: 1 });
});

test('source identity budget cannot grow without bound', () => {
  const result = collectComparisonGcTrace(Array.from({ length: 65 }, (_, index) =>
    gc().replace('abcdef', (index + 1).toString(16))).join('\n'));
  expect(result).toMatchObject({ status: 'partial', truncated: true });
  expect(result.events).toHaveLength(64);
});

test('unknown/invalid phase labels are excluded and do not overwrite the valid bracket', () => {
  const result = collectComparisonGcTrace([phase('catalog_drained', 10), phase('PRIVATE', 20), gc(),
    phase('stopped', -1), phase('stopped', 200)].join('\n'));
  expect(result.events[0]).toMatchObject({ after: { phase: 'catalog_drained', elapsedMs: 10 },
    before: { phase: 'stopped', elapsedMs: 200 } });
});

test('event budget preserves bounded partial evidence rather than a false complete trace', () => {
  const result = collectComparisonGcTrace(Array.from({ length: 1025 }, (_, index) => gc(index)).join('\n'));
  expect(result).toMatchObject({ status: 'partial', truncated: true });
  expect(result.events).toHaveLength(1024);
});
