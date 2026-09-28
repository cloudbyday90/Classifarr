/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const STUDY_MEMORY_KEYS = Object.freeze(['rssBytes', 'heapBytes', 'externalBytes', 'arrayBufferBytes', 'containerBytes']);
const phases = ['steady', 'recovery', 'idle'];
const phaseOrder = ['warmup', 'steady', 'provider_outage', 'telemetry_pressure', 'recovery', 'drain', 'idle'];
const finite = value => Number.isFinite(value) && value >= 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const validIdle = value => Number.isSafeInteger(value) && value >= 10000 && value <= 120000;
function median(values) {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarizePhase(rows) {
  if (rows.length < 5) throw new Error('resource_study_trend_insufficient');
  const spanMs = rows.at(-1).atMs - rows[0].atMs;
  const window = Math.max(2, Math.floor(rows.length / 5));
  const times = rows.map(row => (row.atMs - rows[0].atMs) / 60000);
  const meanTime = times.reduce((sum, value) => sum + value, 0) / times.length;
  const variance = times.reduce((sum, value) => sum + (value - meanTime) ** 2, 0);
  const memory = Object.fromEntries(STUDY_MEMORY_KEYS.map(key => {
    const values = rows.map(row => row[key]), mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const earlyMedianBytes = median(values.slice(0, window)), lateMedianBytes = median(values.slice(-window));
    return [key, { earlyMedianBytes, lateMedianBytes, deltaBytes: lateMedianBytes - earlyMedianBytes,
      sampledPeakBytes: Math.max(...values),
      slopeBytesPerMinute: values.reduce((sum, value, index) => sum + (times[index] - meanTime) * (value - mean), 0) / variance }];
  }));
  const completedDelta = rows.at(-1).completed - rows[0].completed;
  return { samples: rows.length, spanMs, windowSamples: window, memory,
    backlog: { peakPending: Math.max(...rows.map(row => row.pending)),
      oldestPendingSeconds: Math.max(...rows.map(row => row.oldestPendingSeconds)),
      completedDelta, completionsPerSecond: completedDelta / (spanMs / 1000) } };
}

/** Bounded same-process windows, never a leak diagnosis or cross-restart subtraction. */
export function summarizeStudyTrend(samples, idleMs) {
  if (!Array.isArray(samples) || samples.length > 2000 || samples.length < 15 ||
    !validIdle(idleMs)) throw new Error('resource_study_trend_invalid');
  for (let index = 0; index < samples.length; index++) {
    const row = samples[index], previous = samples[index - 1];
    if (!row || !phaseOrder.includes(row.phase) || !count(row.pending) || !count(row.completed) ||
      !['atMs', 'pending', 'completed', 'oldestPendingSeconds', ...STUDY_MEMORY_KEYS].every(key => finite(row[key])) ||
      (previous && (row.atMs <= previous.atMs || row.completed < previous.completed ||
        phaseOrder.indexOf(row.phase) < phaseOrder.indexOf(previous.phase))) ||
      row.failed !== 0 || row.routing !== 0) throw new Error('resource_study_trend_invalid');
  }
  const result = { version: 'resource_study_trend.v1', phases: Object.fromEntries(phases.map(phase =>
    [phase, summarizePhase(samples.filter(row => row.phase === phase))])) };
  assertStudyTrend(result, idleMs);
  return result;
}

export function assertStudyTrend(trend, idleMs) {
  if (trend?.version !== 'resource_study_trend.v1' || !validIdle(idleMs)) throw new Error('resource_study_trend_invalid');
  for (const phase of phases) {
    const row = trend.phases?.[phase], backlog = row?.backlog;
    if (!row || !Number.isSafeInteger(row.samples) || row.samples < 5 || row.samples > 2000 ||
      !Number.isSafeInteger(row.windowSamples) || row.windowSamples < 2 || row.windowSamples * 2 > row.samples ||
      !finite(row.spanMs) || row.spanMs <= 0 || row.spanMs > 2100000 ||
      !backlog || !['peakPending', 'oldestPendingSeconds', 'completedDelta', 'completionsPerSecond'].every(key => finite(backlog[key])) ||
      !count(backlog.peakPending) || !count(backlog.completedDelta) ||
      Math.abs(backlog.completionsPerSecond - backlog.completedDelta / (row.spanMs / 1000)) > 1e-9 ||
      (phase === 'idle' && (row.spanMs < idleMs || row.spanMs > idleMs + 30000 ||
        backlog.peakPending !== 0 || backlog.completedDelta !== 0 || backlog.oldestPendingSeconds !== 0))) {
      throw new Error('resource_study_trend_invalid');
    }
    for (const key of STUDY_MEMORY_KEYS) {
      const value = row.memory?.[key];
      if (!value || !['earlyMedianBytes', 'lateMedianBytes', 'sampledPeakBytes'].every(field => finite(value[field])) ||
        !Number.isFinite(value.deltaBytes) || !Number.isFinite(value.slopeBytesPerMinute) ||
        value.deltaBytes !== value.lateMedianBytes - value.earlyMedianBytes ||
        value.sampledPeakBytes < Math.max(value.earlyMedianBytes, value.lateMedianBytes)) throw new Error('resource_study_trend_invalid');
    }
  }
}
