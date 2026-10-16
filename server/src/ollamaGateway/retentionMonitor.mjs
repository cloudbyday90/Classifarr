/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETENTION_CHECK_INTERVAL_MS } from './retentionAssessment.mjs';

/** Startup + fixed-delay checks; reads of status never start work. */
export function createGatewayRetentionMonitor({ read, onTransition = (_value) => {},
  now = () => Date.now(), monotonic = () => performance.now() }) {
  let stopped = false, timer, last = null, checkedAt = null, nextCheckAt = null, successAt = null;
  let state = 'pending', transition = null;
  const publish = () => {
    const key = state === 'available' ? `${last.capacity}:${last.decision}:${last.reason}:${last.sufficientHeadroom}` : state;
    if (key === transition) return;
    transition = key;
    // The caller receives only the validated aggregate, never exceptions or raw database rows.
    try { onTransition({ state, assessment: last }); } catch { /* Logging cannot interrupt the timer. */ }
  };
  async function check() {
    try {
      const value = await read();
      if (stopped) return;
      last = value; successAt = monotonic(); state = 'available';
    } catch {
      if (stopped) return;
      state = 'unavailable';
    } finally {
      if (!stopped) {
        checkedAt = new Date(now()).toISOString();
        nextCheckAt = new Date(now() + RETENTION_CHECK_INTERVAL_MS).toISOString();
        publish();
        timer = setTimeout(check, RETENTION_CHECK_INTERVAL_MS); timer.unref();
      }
    }
  }
  void check();
  return {
    status() {
      const stale = state === 'available' && (monotonic() - successAt > 2 * RETENTION_CHECK_INTERVAL_MS || monotonic() < successAt);
      return { state: stopped ? 'stopped' : stale ? 'stale' : state, checkedAt, nextCheckAt,
        assessment: last ? structuredClone(last) : null };
    },
    stop() { stopped = true; clearTimeout(timer); nextCheckAt = null; },
  };
}
