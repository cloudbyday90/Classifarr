/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { collectComparisonStudyTrace } from './comparisonStudyTrace.mjs';

// Pinned Node 24 diagnostic text, not a stable API. Never retain identity or cause.
const GC = /^\[(\d+:0x[\da-f]+)\]\s+(\d+) ms: Mark-Compact( \(reduce\))?( \(interleaved\))? (\d+\.\d+) \((\d+\.\d+)\) -> (\d+\.\d+) \((\d+\.\d+)\) MB, pooled: (\d+) MB, (\d+\.\d+) \/ (\d+\.\d+) ms(?: |$)/;
const CANDIDATE = /^\[[^\]\r\n]+\]\s+\S+ ms:/;

/** Major collections only; phase brackets are output order, not aligned clocks. */
export function collectComparisonGcTrace(output) {
  const result = { version: 1, status: 'unavailable', rejected: 0, truncated: false, events: [] };
  if (typeof output !== 'string') return result;
  if (Buffer.byteLength(output) > 8 * 1024 * 1024) { result.truncated = true; return result; }
  const sources = new Map();
  let processId, after = null, pending = [];
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('STUDY_PROGRESS ')) {
      const [phase] = collectComparisonStudyTrace(line);
      if (phase && Number.isSafeInteger(phase.elapsedMs)) {
        after = { phase: phase.phase, elapsedMs: phase.elapsedMs };
        for (const event of pending) event.before = after;
        pending = [];
      }
      continue;
    }
    if (!CANDIDATE.test(line)) continue;
    if (result.events.length >= 1024) { result.truncated = true; break; }
    const match = line.length <= 4096 ? line.match(GC) : null;
    if (!match) { result.rejected++; continue; }
    const values = [match[2], ...match.slice(5)].map(Number);
    const [elapsedMs, heapBeforeMiB, committedBeforeMiB, heapAfterMiB, committedAfterMiB,
      pooledMiB, pauseMs, externalPauseMs] = values;
    const pid = match[1].split(':')[0];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 2 ** 32) ||
        heapBeforeMiB > committedBeforeMiB || heapAfterMiB > committedAfterMiB ||
        (processId && processId !== pid)) { result.rejected++; continue; }
    if (!sources.has(match[1])) {
      if (sources.size >= 64) { result.truncated = true; break; }
      sources.set(match[1], { id: sources.size + 1, previousTime: -1 });
    }
    processId = pid;
    const source = sources.get(match[1]), clockReset = elapsedMs < source.previousTime;
    source.previousTime = elapsedMs;
    // Address reuse after worker teardown is possible: tokens are not worker identities.
    const event = { source: source.id, clockReset, elapsedMs, reduceMemory: Boolean(match[3]), interleaved: Boolean(match[4]),
      heapBeforeMiB, committedBeforeMiB, heapAfterMiB, committedAfterMiB, pooledMiB, pauseMs, externalPauseMs,
      after, before: null };
    result.events.push(event); pending.push(event);
  }
  if (result.events.length) result.status = result.rejected || result.truncated ? 'partial' : 'complete';
  return result;
}
