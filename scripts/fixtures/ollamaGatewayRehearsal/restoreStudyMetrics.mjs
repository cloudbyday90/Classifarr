/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { RESTORE_STUDY, restoreStudyLane } from './restoreStudyContract.mjs';

export const RESTORE_METRICS = Object.freeze(['rss','heapUsed','heapTotal','external','arrayBuffers','heapPhysical','v8Malloc',
  'currentBytes','anonBytes','fileBytes','cpuUsageUs','cpuThrottledUs','readBytes','writeBytes','pressureSomeUs','pressureFullUs']);
const required = RESTORE_METRICS.slice(0,10);
export function createRestoreMeasurements(readSample, { now = () => performance.now() } = {}) {
  const started = now(), bins = new Map(), coverage = {}, peaks = {};
  let phase = 'baseline', cycle = 0, pending, last, samples = 0, failedSamples = 0, capReached = false, maxGapMs = 0, observationMs = 0;
  const tick = async (force = false) => {
    const at = now(); if (pending || !force && last !== undefined && at - last < 950) return;
    if (samples >= RESTORE_STUDY.maxSamples) { capReached = true; return; }
    samples++; if (last !== undefined) maxGapMs = Math.max(maxGapMs, at - last); last = at;
    const key = `${cycle}:${phase}`, bin = bins.get(key) ?? { phase, cycle, samples: 0, values: {} };
    bins.set(key, bin); bin.samples++;
    pending = (async () => {
      try {
        const sample = await readSample();
        for (const key of RESTORE_METRICS) if (sample[key] !== undefined) {
          const value = sample[key];
          if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw new Error('restore_study_sample_invalid');
          coverage[key] = (coverage[key] ?? 0) + 1; peaks[key] = Math.max(peaks[key] ?? 0, value);
          const values = bin.values[key] ??= { first: value, last: value, min: value, max: value, count: 0 };
          values.last = value; values.min = Math.min(values.min, value); values.max = Math.max(values.max, value); values.count++;
        }
      } catch { failedSamples++; }
      finally { observationMs += Math.max(0, now() - at); }
    })();
    try { await pending; } finally { pending = null; }
  };
  return { tick, async phase(name, index) {
    if (!['baseline','restore','quiet','tail'].includes(name) || !Number.isInteger(index) || index < 0 || index > 5) throw new Error('restore_study_phase');
    await pending; phase = name; cycle = index; await tick(true);
  }, async stop() { await pending; }, summary() {
    const elapsedMs = Math.max(0, now() - started);
    return { version: 1, samples, failedSamples, capReached, elapsedMs, observationMs,
      maxGapMs: Math.max(maxGapMs, last === undefined ? elapsedMs : now() - last), coverage, peaks, bins: [...bins.values()] };
  } };
}
export function requireRestoreCoverage(value, lane) {
  restoreStudyLane(lane);
  if (!value || value.version !== 1 || !Number.isInteger(value.samples) || value.samples < 5 || value.samples > RESTORE_STUDY.maxSamples ||
      value.failedSamples || value.capReached || !Number.isFinite(value.maxGapMs) || value.maxGapMs > 5000 ||
      value.maxGapMs < 0 || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 ||
      value.elapsedMs > (lane === 'natural' ? RESTORE_STUDY.naturalMs : RESTORE_STUDY.allocationsMs) ||
      !Array.isArray(value.bins) || value.bins.length > 12 || !value.coverage ||
      required.some(key => !Number.isInteger(value.coverage[key]) || value.coverage[key] > value.samples ||
        value.coverage[key] < value.samples * 0.9)) throw new Error('restore_study_coverage');
  const keys = new Set();
  for (const bin of value.bins) {
    const key = `${bin.cycle}:${bin.phase}`;
    if (!['baseline','restore','quiet','tail'].includes(bin.phase) || !Number.isInteger(bin.cycle) || bin.cycle < 0 || bin.cycle > 5 ||
        !Number.isInteger(bin.samples) || bin.samples < 1 || keys.has(key) ||
        (bin.phase === 'baseline' ? bin.cycle !== 0 : bin.phase === 'tail' ? bin.cycle !== 5 : bin.cycle < 1)) throw new Error('restore_study_coverage');
    keys.add(key);
  }
  if (value.bins.reduce((sum, bin) => sum + bin.samples, 0) !== value.samples) throw new Error('restore_study_coverage');
  if ([1,2,3,4,5].some(cycle => !keys.has(`${cycle}:restore`))) throw new Error('restore_study_coverage');
  if (lane === 'natural' && (value.elapsedMs < 597500 || value.samples < value.elapsedMs / 1400 ||
      (value.bins.find(bin => bin.phase === 'baseline')?.samples ?? 0) < 45 ||
      (value.bins.find(bin => bin.phase === 'tail')?.samples ?? 0) < 240 ||
      [1,2,3,4].some(cycle => (value.bins.find(bin => bin.phase === 'quiet' && bin.cycle === cycle)?.samples ?? 0) < 45))) {
    throw new Error('restore_study_coverage');
  }
  return value;
}
