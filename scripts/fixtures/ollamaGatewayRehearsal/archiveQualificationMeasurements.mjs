/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';

/** Fixed-size, external observations; never an admission decision or exact phase timer. */
export function createQualificationMeasurements(readSample, { now = () => performance.now(), intervalMs = 500, maxSamples = 420 } = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 100 || !Number.isSafeInteger(maxSamples) || maxSamples < 1 || maxSamples > 420) {
    throw new Error('qualification_measurement_limits');
  }
  const started = now(), windows = {}, peaks = {};
  const coverage = { current: 0, cgroup: 0, pressure: 0, worker: 0, observer: 0, dump: 0, dumpPresence: 0 };
  let count = 0, partial = 0, failed = 0, busy = false, last = null, next = started, maxGapMs = 0, observationMs = 0, dumpSeen = false;
  return {
    async tick() {
      const time = now();
      if (busy || count >= maxSamples || time < next) return;
      busy = true; count++;
      if (last !== null) maxGapMs = Math.max(maxGapMs, time - last);
      last = time;
      try {
        const sample = await readSample();
        if (sample.status !== 'complete') partial++;
        for (const [key, present] of [['current', sample.currentBytes !== undefined], ['cgroup', Boolean(sample.cgroup)],
          ['pressure', sample.pressureStatus === 'available'], ['worker', Boolean(sample.worker)], ['observer', Boolean(sample.observer)],
          ['dump', Boolean(sample.dump)], ['dumpPresence', sample.dumpPresence !== 'unknown']]) if (present) coverage[key]++;
        const phase = sample.dumpPresence === 'unknown' ? 'unknown' : sample.dumpPresence === 'present' ? 'dump_present' :
          dumpSeen ? 'after_dump_observed' : 'before_dump_observed';
        if (sample.dumpPresence === 'present') dumpSeen = true;
        const observation = { elapsedMs: time - started, ...sample };
        const window = windows[phase] ??= { samples: 0, firstObservedMs: time - started };
        window.samples++; window.lastObservedMs = time - started;
        if (sample.currentBytes !== undefined && (!window.atSampledPeak || sample.currentBytes > window.atSampledPeak.currentBytes)) window.atSampledPeak = observation;
        for (const [key, value] of [['cgroup', sample.currentBytes], ['worker', sample.worker?.rssBytes],
          ['dump', sample.dump?.rssBytes], ['observer', sample.observer?.rssBytes]]) {
          if (value !== undefined && (!peaks[key] || value > peaks[key].value)) peaks[key] = { value, observation };
        }
      } catch { failed++; }
      finally {
        observationMs += Math.max(0, now() - time); next = now() + intervalMs; busy = false;
      }
    },
    summary() {
      const elapsedMs = Math.max(0, now() - started);
      return { version: 1, status: !count ? 'unavailable' : partial || failed || busy || count >= maxSamples ? 'partial' : 'complete',
        intervalMs, maxSamples, samples: count, partialSamples: partial, failedSamples: failed,
        capReached: count >= maxSamples, elapsedMs, observationMs, maxGapMs: Math.max(maxGapMs, last === null ? elapsedMs : now() - last),
        dumpObserved: dumpSeen, coverage, windows, peaks };
    },
  };
}
