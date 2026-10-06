/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const NUMBERS = ['elapsedMs', 'rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers',
  'containerBytes', 'kernelPeakBytes', 'pids', 'activeWorkers', 'workerHeapUsed',
  'memoryLimitHits', 'oomKill', 'createdWorkers', 'exitedWorkers', 'estimatedCacheBytes', 'reads', 'builds',
  'attempt', 'availableBytes', 'reserveBytes', 'reservedBytes', 'workBytes', 'hysteresisBytes', 'requiredBytes',
  'inventory', 'completed', 'descriptions', 'cached'];
const REFERENCES = ['snapshot', 'decodedVector', 'ownedSource', 'ownedVector',
  'comparisonHandle', 'communityRows', 'communityVector'];
const PEAK_NUMBERS = ['samples', 'rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers',
  'containerBytes', 'kernelPeakBytes', 'pids', 'activeWorkers', 'workerHeapUsed', 'memoryLimitHits', 'oomKill'];
const PHASE = /^(setup|baseline|stopped|post_stop_idle|summary|catalog_drained|recovery_(admission|source_changed|read_\d{1,2}|build_start|build_end|representative_fit|representative|comparison|worker_fit|control|community|quality)|cycle_[0-4]_(start|read_\d{1,2}|build_start|build_end|representative_fit|representative|comparison|idle|worker_fit|control|community|quality))$/;
const STATUSES = new Set(['ready', 'published', 'up_to_date', 'revalidated', 'deferred', 'unavailable', 'degraded',
  'not_due', 'yielded', 'cancelled', 'disabled', 'unsupported_provider', 'cache_budget_exceeded',
  'already_running', 'cooldown', 'failed', 'invalidated', 'capacity']);
const REASONS = new Set(['busy', 'memory_pressure', 'memory_unknown', 'ingesting', 'backfilling',
  'waiting_for_libraries', 'waiting_for_inventory', 'disabled', 'unavailable']);

function projectPeaks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 128) return null;
  const peaks = {};
  for (const [phase, sample] of Object.entries(value)) {
    if (!PHASE.test(phase) || !sample || typeof sample !== 'object' || Array.isArray(sample) ||
        !Number.isSafeInteger(sample.samples) || sample.samples < 1) continue;
    const row = {};
    for (const key of PEAK_NUMBERS) if (Number.isSafeInteger(sample[key]) && sample[key] >= 0) row[key] = sample[key];
    peaks[phase] = row;
  }
  return Object.keys(peaks).length ? peaks : null;
}

/** Failure evidence is a numeric projection, never raw logs or provider payloads. */
export function collectComparisonStudyTrace(output) {
  if (typeof output !== 'string' || output.length > 8 * 1024 * 1024) return [];
  const trace = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith('STUDY_PROGRESS ') || line.length > 65_536) continue;
    let value;
    try { value = JSON.parse(line.slice(15)); } catch { continue; }
    if (!value || typeof value !== 'object' || typeof value.phase !== 'string' || !PHASE.test(value.phase)) continue;
    if (line.length > 16_384 && value.phase !== 'summary') continue;
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
    if (value.phase === 'summary') {
      const peaks = projectPeaks(value.peaks);
      if (peaks) row.peaks = peaks;
    }
    trace.push(row);
    if (trace.length === 256) break;
  }
  return trace;
}
