/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as sleep } from 'node:timers/promises';
import { probeEmbeddedDatabase } from './embeddedDatabaseProbe.mjs';

/** Process liveness only, not SQL readiness. No overlapping checks or relaunch. */
export async function watchEmbeddedDatabase({ database, signal, requestStop, report = () => {},
  delay = sleep, now = () => performance.now(), probe = probeEmbeddedDatabase,
  intervalMs = 5000, graceMs = 15_000,
}) {
  let uncertainSince;
  const remaining = () => uncertainSince === undefined ? Infinity : graceMs - (now() - uncertainSince);
  const fail = reason => requestStop({ reason, failed: true });
  // Diagnostic sink failure must not change whether an operation was joined.
  const emit = (...args) => { try { report(...args); } catch { /* best-effort diagnostics */ } };
  try {
    while (!signal.aborted) {
      await delay(Math.min(intervalMs, Math.max(0, remaining())), undefined, { signal });
      if (signal.aborted) break;
      if (remaining() <= 0) { fail('database_probe_grace_expired'); break; }
      const result = await probe(options => database.check(options), {
        signal, timeoutMs: Math.min(3000, remaining()), now,
      });
      if (!result.joined) {
        emit('database_probe_exit_unconfirmed');
        if (!signal.aborted) fail('database_probe_exit_unconfirmed');
        return { joined: false };
      }
      if (signal.aborted || result.state === 'cancelled') break;
      if (result.state === 'failed') { fail('database_unavailable'); break; }
      if (remaining() <= 0) { fail('database_probe_grace_expired'); break; }
      if (result.state === 'ok') {
        if (uncertainSince !== undefined) emit('database_probe_recovered');
        uncertainSince = undefined;
      } else if (result.state === 'transient') {
        if (uncertainSince === undefined) {
          uncertainSince = now();
          emit('database_probe_waiting', result.reason);
        }
      } else { fail('database_unavailable'); break; }
    }
  } catch {
    if (!signal.aborted) fail('database_unavailable');
  }
  return { joined: true };
}
