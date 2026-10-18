/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';

const fields = Object.freeze(['currentBytes','anonBytes','fileBytes','workerRssBytes','observerRssBytes','heapUsedBytes',
  'cpuUsageUs','cpuThrottledUs','readBytes','writeBytes','pressureSomeUs','pressureFullUs','maxTransactionAgeMs','observedTransactions']);

/** Bounded one-second observations; missing fields are never manufactured as zero. */
export function createStudyMeasurements(readSample, { now = () => performance.now(), phase = () => 'worker' } = {}) {
  const started = now(), bins = new Map(), coverage = {}, peaks = {};
  let samples = 0, failed = 0, last, maxGapMs = 0, observationMs = 0, pending = null, capped = false;
  const tick = async () => {
    const at = now();
    if (pending || last !== undefined && at - last < 950) return;
    if (samples >= 2048) { capped = true; return; }
    samples++; if (last !== undefined) maxGapMs = Math.max(maxGapMs, at - last); last = at;
    const name = phase();
    if (!['before','archives','after','idle','worker'].includes(name)) throw new Error('study_phase_invalid');
    const key = `${Math.floor((at - started) / 60000)}:${name}`;
    if (!bins.has(key) && bins.size >= 64) throw new Error('study_bins_exhausted');
    const bin = bins.get(key) ?? { phase: name, firstMs: at - started, lastMs: at - started, samples: 0, values: {} };
    bins.set(key, bin); bin.samples++; bin.lastMs = at - started;
    pending = (async () => {
      try {
        const sample = await readSample();
        for (const key of fields) if (sample[key] !== undefined && (!Number.isFinite(sample[key]) || sample[key] < 0)) throw new Error('study_sample_invalid');
        for (const key of fields) if (sample[key] !== undefined) {
          const value = sample[key]; coverage[key] = (coverage[key] ?? 0) + 1;
          const values = bin.values[key] ??= { first: value, last: value, min: value, max: value, count: 0 };
          values.last = value; values.min = Math.min(values.min, value); values.max = Math.max(values.max, value); values.count++;
          peaks[key] = Math.max(peaks[key] ?? 0, value);
        }
      } catch { failed++; }
      finally { observationMs += Math.max(0, now() - at); }
    })();
    try { await pending; } finally { pending = null; }
  };
  return { tick, async stop() { await pending; }, summary() {
    const elapsedMs = Math.max(0, now() - started);
    return { version: 1, intervalMs: 1000, maxSamples: 2048, samples, failedSamples: failed, capReached: capped,
      elapsedMs, maxGapMs: Math.max(maxGapMs, last === undefined ? elapsedMs : now() - last), observationMs,
      coverage, peaks, bins: [...bins.values()] };
  } };
}

export function requireStudyCoverage(summary, minimumMs, idle = false) {
  if (!Number.isFinite(minimumMs) || minimumMs < 0 || minimumMs > 1920000 || !summary || summary.version !== 1 ||
      !Number.isInteger(summary.samples) || summary.samples < 1 || summary.samples > 2048 ||
      !Number.isFinite(summary.elapsedMs) || !Number.isFinite(summary.maxGapMs) || !Array.isArray(summary.bins) || summary.bins.length > 64 ||
      summary.capReached || summary.failedSamples || summary.elapsedMs < minimumMs || summary.maxGapMs > 5000 ||
      summary.samples < minimumMs / 1400 || ['currentBytes','anonBytes','fileBytes'].some(key =>
        (summary.coverage[key] ?? 0) < summary.samples * 0.9) || idle &&
        summary.bins.filter(bin => bin.phase === 'idle').reduce((sum, bin) => sum + bin.samples, 0) < 45) throw new Error('study_coverage_invalid');
  return summary;
}
