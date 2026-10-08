/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { memoryUsage } from 'node:process';
import { readRuntimeMemory } from './runtimeMemoryBudget.mjs';

const stages = new Set(['admission', 'provider_inspection', 'snapshot_read', 'source_validation',
  'profile_build', 'snapshot_verify', 'provider_verify', 'state_verify', 'publication', 'settled']);
const phases = new Set(['shared_admission', 'start_checkpoint', 'running_checkpoint']);
const trusted = new WeakSet();
const number = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const attemptId = () => randomUUID();
const safeRead = callback => { try { return callback(); } catch { return null; } };
const read = (value, key) => safeRead(() => value?.[key]);
const fields = (value, names) => Object.fromEntries(names.map(name => [name, number(read(value, name))]));
const freeze = value => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
};

/** Only locally constructed, deeply immutable, numeric/category-only records may reach logs. */
export function describeComparisonMemoryEvidence(value) {
  return trusted.has(value) ? value : undefined;
}

/** Event-driven observations, not a sampler, heap profiler, or admission authority. */
export function createComparisonMemoryEvidence({ readMemory = readRuntimeMemory, readUsage = memoryUsage,
  now = Date.now } = {}) {
  let recent = [], episode = null;
  const capture = (stage, readCache) => {
    const memory = safeRead(readMemory), usage = safeRead(readUsage), cache = safeRead(readCache);
    return freeze({ at: number(safeRead(now)), stage: stages.has(stage) ? stage : 'unknown',
      availableBytes: number(read(memory, 'available')), constrainedBytes: number(read(memory, 'constrained')),
      process: fields(usage, ['rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers']),
      cache: fields(cache, ['entries', 'estimatedBytes']) });
  };
  return {
    begin(readCache = () => null) {
      const id = attemptId(), start = capture('admission', readCache);
      let peak = start, samples = 1, decision = null, admission = null, refusedAt = null, stage = 'admission', source = null;
      const sample = next => {
        stage = stages.has(next) ? next : 'unknown';
        if (samples >= 15) return null;
        const value = capture(stage, readCache); samples++;
        if (value.process.rss !== null && (peak.process.rss === null || value.process.rss > peak.process.rss)) peak = value;
        return value;
      };
      return {
        stage: sample,
        source(value) { source = freeze(fields(value, ['libraries', 'documents', 'vectors', 'dimensions'])); },
        decision(value) {
          // Preserve the first refusal, including its original stage before asynchronous cleanup.
          if (decision?.allowed === false || !phases.has(read(value, 'phase'))) return;
          const projected = safeRead(() => ({
            phase: value.phase, stage, allowed: value.allowed === true,
            reason: ['memory_pressure', 'memory_unknown', 'busy'].includes(value.reason) ? value.reason : null,
            ...fields(value, ['availableBytes', 'constrainedBytes', 'effectiveLimitBytes', 'requiredBytes', 'reserveBytes',
              'reservedBytes', 'workBytes', 'hysteresisBytes']),
            active: fields(value.active, ['ingestion', 'queue', 'discovery']),
          }));
          if (!projected) return;
          decision = freeze(projected);
          if (decision.phase === 'shared_admission') admission = decision;
          if (!decision.allowed) refusedAt = sample(stage);
        },
        finish(report) {
          const end = capture('settled', readCache);
          if (end.process.rss !== null && (peak.process.rss === null || end.process.rss > peak.process.rss)) peak = end;
          const completed = ['ready', 'revalidated'].includes(report?.status);
          const pressure = report?.status === 'deferred' && ['memory_pressure', 'memory_unknown'].includes(report.reason);
          if (pressure && !episode) episode = { reference: randomUUID(), firstAt: refusedAt?.at ?? end.at, attempts: 0 };
          if (episode) episode.attempts++;
          let evidence;
          if (pressure || (completed && episode)) {
            const baseline = recent.at(-1)?.end ?? null;
            evidence = freeze({ version: 1, reference: episode.reference, firstAt: episode.firstAt,
              usageScope: 'process_rss_main_thread_heap',
              attempts: episode.attempts, attemptId: id, samples: samples + 1, start, peak, end, admission, decision, refusedAt, source,
              elapsedMs: start.at !== null && end.at !== null ? number(end.at - start.at) : null,
              referenceKind: baseline ? 'last_completed_refresh' : 'no_completed_refresh',
              recentCompleted: [...recent],
              rssDeltaFromReference: baseline?.process.rss != null && end.process.rss != null
                ? end.process.rss - baseline.process.rss : null,
              heapDeltaFromReference: baseline?.process.heapUsed != null && end.process.heapUsed != null
                ? end.process.heapUsed - baseline.process.heapUsed : null });
            trusted.add(evidence);
          }
          if (completed) {
            recent = [...recent.slice(-2), freeze({ attemptId: id, status: report.status, source, end })];
            episode = null;
          }
          return evidence;
        },
      };
    },
  };
}
