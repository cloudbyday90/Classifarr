/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const NUMBERS = ['elapsedMs', 'rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers',
  'containerBytes', 'kernelPeakBytes', 'pids', 'activeWorkers', 'workerHeapUsed',
  'memoryLimitHits', 'oomKill', 'createdWorkers', 'exitedWorkers', 'estimatedCacheBytes', 'reads', 'builds',
  'attempt', 'availableBytes', 'reserveBytes', 'reservedBytes', 'workBytes', 'hysteresisBytes', 'requiredBytes'];
const REFERENCES = ['snapshot', 'decodedVector', 'ownedSource', 'ownedVector',
  'comparisonHandle', 'communityRows', 'communityVector'];
const PHASE = /^(setup|baseline|stopped|post_stop_idle|summary|recovery_(admission|source_changed|read_\d{1,2}|build_start|build_end|representative_fit|representative|comparison|worker_fit|control|community|quality)|cycle_[0-4]_(start|read_\d{1,2}|build_start|build_end|representative_fit|representative|comparison|idle|worker_fit|control|community|quality))$/;
const STATUSES = new Set(['ready', 'published', 'up_to_date', 'revalidated', 'deferred', 'unavailable', 'degraded',
  'not_due', 'yielded', 'cancelled', 'disabled', 'already_running', 'cooldown', 'failed', 'invalidated', 'capacity']);
const REASONS = new Set(['busy', 'memory_pressure', 'memory_unknown']);

/** Failure evidence is a numeric projection, never raw logs or provider payloads. */
export function collectComparisonStudyTrace(output) {
  if (typeof output !== 'string' || output.length > 8 * 1024 * 1024) return [];
  const trace = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith('STUDY_PROGRESS ') || line.length > 16_384) continue;
    let value;
    try { value = JSON.parse(line.slice(15)); } catch { continue; }
    if (!value || typeof value !== 'object' || typeof value.phase !== 'string' || !PHASE.test(value.phase)) continue;
    const row = { phase: value.phase };
    for (const key of NUMBERS) if (Number.isSafeInteger(value[key]) && value[key] >= 0) row[key] = value[key];
    if (STATUSES.has(value.status)) row.status = value.status;
    if (REASONS.has(value.reason)) row.reason = value.reason;
    if (typeof value.diagnosticGc === 'boolean') row.diagnosticGc = value.diagnosticGc;
    if (['comparison', 'representative'].includes(value.worker)) row.worker = value.worker;
    if (value.kind === 'discovery') row.kind = value.kind;
    if (typeof value.allowed === 'boolean') row.allowed = value.allowed;
    if (value.alive && typeof value.alive === 'object') {
      row.alive = {};
      for (const key of REFERENCES) if (Number.isSafeInteger(value.alive[key]) && value.alive[key] >= 0) row.alive[key] = value.alive[key];
    }
    trace.push(row);
    if (trace.length === 256) break;
  }
  return trace;
}
