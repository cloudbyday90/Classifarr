/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { correlateComparisonGcResidency } from '../../../../scripts/lib/comparisonGcResidency.mjs';
import { collectComparisonGcTrace } from '../../../../scripts/lib/comparisonGcTrace.mjs';
import { createMappingCounterParser } from '../../scripts/comparisonMemoryStudy/mappingCounters.mjs';

function mappings(count) {
  const parser = createMappingCounterParser();
  for (let index = 0; index < count; index++) parser.push('1000-41000 rw-p 00000000 00:00 0\n' +
    'Size: 256 kB\nRss: 256 kB\nPss: 256 kB\nAnonymous: 256 kB\nPrivate_Dirty: 256 kB\nSwap: 0 kB\nLazyFree: 0 kB\nVmFlags: rd wr\n');
  return parser.finish();
}
function residency() {
  return { version: 1, durationMs: 120000, samples: Array.from({ length: 5 }, (_, index) => ({
    elapsedMs: 500000 + index * 30000, rss: index === 4 ? 300000 : 1000000, heapUsed: 100000,
    heapTotal: 200000, external: 1000, arrayBuffers: 500, containerBytes: 2000000,
    createdWorkers: 12, exitedWorkers: 12, activeWorkers: 0,
    mainHeapPhysicalBytes: 210000, mainV8MallocBytes: 1000, mappings: mappings(index === 4 ? 1 : 3),
  })) };
}
const bracket = index => ({ phase: `post_stop_residency_${index}`, elapsedMs: 500000 + index * 30000 });
const event = (index = 3) => ({ source: 2, clockReset: false, elapsedMs: 888888,
  reduceMemory: true, pooledMiB: 0, after: bracket(index), before: bracket(index + 1) });
const trace = (...events) => ({ version: 1, status: 'complete', rejected: 0, truncated: false, events });

test('uses output brackets, not GC clocks, and projects only four fixed numeric intervals', () => {
  const gc = event(); gc.payload = 'private';
  const result = correlateComparisonGcResidency(residency(), trace(gc));
  expect(result).toMatchObject({ version: 1, status: 'measured', scope: 'output_order_phase_brackets' });
  expect(result.intervals).toHaveLength(4);
  expect(result.intervals[3]).toEqual({ fromMs: 590000, toMs: 620000,
    rssDeltaBytes: -700000, mainHeapDeltaBytes: 0, anonymousWritableRssDeltaBytes: -524288,
    anonymousWritableMapCountDelta: -2, smallWritableRssDeltaBytes: -524288, smallWritableMapCountDelta: -2,
    majorCollections: 1, reduceCollections: 1, firstReportedPoolMiB: 0, lastReportedPoolMiB: 0 });
  expect(result.intervals[0]).toMatchObject({ majorCollections: 0, firstReportedPoolMiB: null, lastReportedPoolMiB: null });
  expect(JSON.stringify(result)).not.toMatch(/private|888888|source|payload/);
});

test('retains first/last reported pool values without claiming they are pre/post-GC values', () => {
  const first = { ...event(), pooledMiB: 456, reduceMemory: false };
  const last = { ...event(), elapsedMs: first.elapsedMs + 1 };
  expect(correlateComparisonGcResidency(residency(), trace(first, last)).intervals[3]).toMatchObject({
    majorCollections: 2, reduceCollections: 1, firstReportedPoolMiB: 456, lastReportedPoolMiB: 0,
  });
});

test('no quiet collection is measured absence, not zero pool; ignores outside-window events', () => {
  const outside = { ...event(), after: { phase: 'stopped', elapsedMs: 0 }, before: bracket(0) };
  const ended = { ...event(), after: bracket(4), before: null };
  const result = correlateComparisonGcResidency(residency(), trace(outside, ended));
  expect(result.status).toBe('measured');
  expect(result.intervals.every(row => row.majorCollections === 0 && row.firstReportedPoolMiB === null)).toBe(true);
});

test.each([
  null, trace(), { ...trace(event()), version: 2 }, { ...trace(event()), status: 'partial' },
  { ...trace(event()), rejected: 1 }, { ...trace(event()), truncated: true }, trace(null),
  trace({ ...event(), pooledMiB: NaN }), trace({ ...event(), pooledMiB: -1 }),
  trace({ ...event(), pooledMiB: 2 ** 33 }), trace({ ...event(), source: 65 }),
  trace({ ...event(), reduceMemory: 'private' }), trace(...Array(1025).fill(event())),
])('incomplete or malformed trace never becomes valid zero evidence (%#)', value => {
  expect(correlateComparisonGcResidency(residency(), value)).toEqual({
    version: 1, status: 'unavailable', reason: 'gc_trace_incomplete', intervals: [],
  });
});

test.each([
  gc => { gc.before = null; }, gc => { gc.before.elapsedMs++; }, gc => { gc.after.elapsedMs++; },
  gc => { gc.before.phase = 'post_stop_residency_3'; },
])('mismatched or missing phase brackets are unavailable (%#)', change => {
  const gc = event(); change(gc);
  expect(correlateComparisonGcResidency(residency(), trace(gc)).reason).toBe('gc_phase_mismatch');
});

test.each([
  [event(), { ...event(), source: 3 }], [event(), { ...event(), elapsedMs: 1 }],
  [{ ...event(), clockReset: true }],
])('ambiguous sources or regressed clocks cannot claim correlation (%#)', (...events) => {
  expect(correlateComparisonGcResidency(residency(), trace(...events)).reason).toBe('gc_source_ambiguous');
});

test('backward quiet intervals are unavailable even if the isolate clock increases', () => {
  expect(correlateComparisonGcResidency(residency(), trace(event(3), event(2))).reason).toBe('gc_phase_mismatch');
});

test('missing GC observation/mapping reads stay explicit; invalid quiet receipts are rejected', () => {
  expect(correlateComparisonGcResidency(undefined, trace(event())).reason).toBe('quiet_window_missing');
  const unavailable = residency(); unavailable.samples[0].mappings = { status: 'unavailable' };
  expect(correlateComparisonGcResidency(unavailable, trace(event())).reason).toBe('mapping_evidence_unavailable');
  const active = residency(); active.samples[1].activeWorkers = 1;
  expect(() => correlateComparisonGcResidency(active, trace(event()))).toThrow();
});

test('real sanitized parser output correlates without retaining identities or causes', () => {
  const phase = index => `STUDY_PROGRESS ${JSON.stringify(bracket(index))}`;
  const gc = '[123:0xabcdef] 888888 ms: Mark-Compact (reduce) 40.0 (45.0) -> 39.0 (44.0) MB, pooled: 0 MB, 1.00 / 0.00 ms private';
  const evidence = collectComparisonGcTrace([phase(3), gc, phase(4)].join('\n'));
  const result = correlateComparisonGcResidency(residency(), evidence);
  expect(result.intervals[3].reduceCollections).toBe(1);
  expect(JSON.stringify(result)).not.toMatch(/private|abcdef|123|888888/);
});
