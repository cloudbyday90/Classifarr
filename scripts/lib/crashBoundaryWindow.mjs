/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { BACKLOG_GATE_SLEEP_MS } from '../../server/src/scripts/installationBacklogContract.mjs';

const stages = Object.freeze(['readyObserved', 'targetResolved', 'preparationComplete', 'verificationStarted',
  'boundaryVerified', 'killDispatched', 'killReturned', 'exitObserved', 'exitVerified']);

/** Relative timings only. The DB window is charged from before the verification request. */
export function createCrashBoundaryWindow({ backlog, now = () => performance.now() }) {
  if (typeof backlog !== 'boolean') throw new TypeError('invalid_crash_scenario');
  const origin = now();
  if (!Number.isFinite(origin)) throw new Error('upgrade_crash_clock_invalid');
  const events = [];
  let last = origin, verificationStarted, windowMs = null;
  const read = () => {
    const value = now();
    if (!Number.isFinite(value) || value < last || value - origin > 600000) throw new Error('upgrade_crash_clock_invalid');
    last = value;
    return value;
  };
  return {
    mark(stage) {
      if (stage !== stages[events.length]) throw new Error('upgrade_crash_timeline_invalid');
      const at = read();
      if (stage === 'verificationStarted') verificationStarted = at;
      events.push({ stage, elapsedMs: Math.round((at - origin) * 1000) / 1000 });
    },
    setWindow(milliseconds) {
      if (!backlog || windowMs !== null || verificationStarted === undefined ||
        events.at(-1)?.stage !== 'boundaryVerified' || !Number.isSafeInteger(milliseconds) ||
        milliseconds <= 0 || milliseconds > BACKLOG_GATE_SLEEP_MS) throw new Error('upgrade_crash_window_invalid');
      windowMs = milliseconds;
    },
    remaining() {
      if (windowMs === null || verificationStarted === undefined) throw new Error('upgrade_crash_window_invalid');
      const remaining = Math.floor(windowMs - (read() - verificationStarted));
      if (remaining <= 0) throw new Error('upgrade_crash_window_expired');
      return remaining;
    },
    receipt() {
      return { version: 1, scenario: backlog ? 'backlog' : 'scheduled', windowMs,
        outcome: events.at(-1)?.stage === 'exitVerified' ? 'verified' : 'not_verified',
        events: events.map(({ stage, elapsedMs }) => ({ stage, elapsedMs })) };
    },
  };
}
