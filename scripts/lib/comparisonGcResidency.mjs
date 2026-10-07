/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertQuiescentResidency } from '../../server/src/scripts/comparisonMemoryStudy/quiescentResidency.mjs';

const unavailable = reason => ({ version: 1, status: 'unavailable', reason, intervals: [] });
const PHASE = /^post_stop_residency_([0-4])$/;
const finite = value => Number.isFinite(value) && value >= 0 && value <= 2 ** 32;

/** Output order only: never align isolate clocks or infer allocator ownership. */
export function correlateComparisonGcResidency(residency, gcTrace) {
  if (!residency) return unavailable('quiet_window_missing');
  assertQuiescentResidency(residency);
  if (gcTrace?.version !== 1 || gcTrace.status !== 'complete' || gcTrace.rejected !== 0 || gcTrace.truncated !== false ||
      !Array.isArray(gcTrace.events) || !gcTrace.events.length || gcTrace.events.length > 1024) {
    return unavailable('gc_trace_incomplete');
  }
  const { samples } = residency;
  if (gcTrace.events.some(event => !event || !Number.isSafeInteger(event.source) || event.source < 1 || event.source > 64 ||
      typeof event.clockReset !== 'boolean' || !finite(event.elapsedMs) ||
      typeof event.reduceMemory !== 'boolean' || !finite(event.pooledMiB))) return unavailable('gc_trace_incomplete');
  if (samples.some(row => row.mappings.status !== 'complete')) return unavailable('mapping_evidence_unavailable');
  const intervals = samples.slice(1).map((row, index) => {
    const previous = samples[index];
    const mappings = row.mappings.categories.anonymousWritable;
    const oldMappings = previous.mappings.categories.anonymousWritable;
    const small = row.mappings.writableSizeBuckets.upTo1MiB;
    const oldSmall = previous.mappings.writableSizeBuckets.upTo1MiB;
    return { fromMs: previous.elapsedMs, toMs: row.elapsedMs,
      rssDeltaBytes: row.rss - previous.rss, mainHeapDeltaBytes: row.heapUsed - previous.heapUsed,
      anonymousWritableRssDeltaBytes: mappings.rssBytes - oldMappings.rssBytes,
      anonymousWritableMapCountDelta: mappings.count - oldMappings.count,
      smallWritableRssDeltaBytes: small.rssBytes - oldSmall.rssBytes,
      smallWritableMapCountDelta: small.count - oldSmall.count,
      majorCollections: 0, reduceCollections: 0, firstReportedPoolMiB: null, lastReportedPoolMiB: null };
  });
  const sources = new Set();
  let previousClock = -1, previousInterval = -1;
  for (const event of gcTrace.events) {
    const match = typeof event?.after?.phase === 'string' ? event.after.phase.match(PHASE) : null;
    if (!match || match[1] === '4') continue; // Outside the four completed quiet intervals.
    const index = Number(match[1]);
    if (index < previousInterval || event.after.elapsedMs !== samples[index].elapsedMs ||
        event.before?.phase !== `post_stop_residency_${index + 1}` ||
        event.before.elapsedMs !== samples[index + 1].elapsedMs) return unavailable('gc_phase_mismatch');
    previousInterval = index;
    if (!Number.isSafeInteger(event.source) || event.source < 1 || event.source > 64 ||
        event.clockReset !== false || !finite(event.elapsedMs) || event.elapsedMs < previousClock) {
      return unavailable('gc_source_ambiguous');
    }
    sources.add(event.source);
    if (sources.size > 1) return unavailable('gc_source_ambiguous');
    previousClock = event.elapsedMs;
    if (typeof event.reduceMemory !== 'boolean' || !finite(event.pooledMiB)) return unavailable('gc_trace_incomplete');
    const interval = intervals[index];
    interval.majorCollections++; interval.reduceCollections += Number(event.reduceMemory);
    interval.firstReportedPoolMiB ??= event.pooledMiB;
    interval.lastReportedPoolMiB = event.pooledMiB;
  }
  return { version: 1, status: 'measured', scope: 'output_order_phase_brackets', intervals };
}
