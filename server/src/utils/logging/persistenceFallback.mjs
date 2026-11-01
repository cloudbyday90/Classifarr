/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';

const INTERVAL_MS = 60_000;
const MESSAGE = 'Classifarr log persistence unavailable; check logging and database health.';

/** Fixed output only. Never receives a failure, payload or caller-derived key. */
export function createLogPersistenceFallback({
  clock = () => performance.now(),
  emit = message => {
    // eslint-disable-next-line no-console -- Last-resort fixed output must not recurse through application logging.
    console.error(message);
  },
} = {}) {
  let lastAttemptAt = null;
  return () => {
    let time;
    try { time = clock(); } catch { return; }
    if (!Number.isFinite(time) || time < 0) return;
    if (lastAttemptAt !== null && time - lastAttemptAt < INTERVAL_MS) return;
    // Consume the interval before output, including reentrant or failed emissions.
    lastAttemptAt = time;
    try {
      Promise.resolve(emit(MESSAGE)).catch(() => {}); // swallow-error: Fallback output failure cannot reject persistence or recurse into logging.
    } catch { /* Preserve the original null result even if the output sink throws. */ }
  };
}
