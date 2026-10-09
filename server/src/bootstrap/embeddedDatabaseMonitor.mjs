/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as sleep } from 'node:timers/promises';
import { probeEmbeddedDatabase } from './embeddedDatabaseProbe.mjs';
import { randomUUID } from 'node:crypto';
import { createEmbeddedProbeTrace, observeProbe, supervisorProbeResources } from './embeddedProbeDiagnostics.mjs';

/** Process liveness only, not SQL readiness. No overlapping checks or relaunch. */
export async function watchEmbeddedDatabase({ database, signal, requestStop, report = () => {},
  delay = sleep, now = () => performance.now(), probe = probeEmbeddedDatabase,
  intervalMs = 5000, graceMs = 15_000,
}) {
  let uncertainSince;
  let sequence = 0, lastHealthy = null, latest = null, firstFailure = null, episodeId, terminal = false;
  const remaining = () => uncertainSince === undefined ? Infinity : graceMs - (now() - uncertainSince);
  // Diagnostic sink failure must not change whether an operation was joined.
  const emit = (...args) => { try { report(...args); } catch { /* best-effort diagnostics */ } };
  const diagnostic = phase => {
    try {
      episodeId ??= randomUUID();
      firstFailure ??= latest;
      emit('database_probe_diagnostic', phase, { schemaVersion: 1, episodeId,
        at: new Date().toISOString(), graceMs, uncertainForMs: uncertainSince === undefined ? 0 : Math.max(0, Math.round(now() - uncertainSince)),
        lastHealthy, firstFailure, latest, resources: supervisorProbeResources() });
    } catch { /* Telemetry cannot interfere with stop, cancellation or recovery. */ }
  };
  const fail = reason => { terminal = true; diagnostic(reason); requestStop({ reason, failed: true }); };
  try {
    while (!signal.aborted) {
      await delay(Math.min(intervalMs, Math.max(0, remaining())), undefined, { signal });
      if (signal.aborted) break;
      if (remaining() <= 0) { fail('database_probe_grace_expired'); break; }
      const timeoutMs = Math.min(3000, remaining());
      let trace;
      try { trace = createEmbeddedProbeTrace({ timeoutMs, sequence: ++sequence, now }); }
      catch { /* Missing diagnostics cannot change the check result. */ }
      const result = await probe(options => database.check(options), {
        signal, timeoutMs, now, observe: trace?.observe,
      });
      observeProbe(trace?.observe, 'outcome', result);
      latest = trace?.snapshot() ?? null;
      if (!result.joined) {
        emit('database_probe_exit_unconfirmed');
        terminal = true; diagnostic('database_probe_exit_unconfirmed');
        if (!signal.aborted) requestStop({ reason: 'database_probe_exit_unconfirmed', failed: true });
        return { joined: false };
      }
      if (signal.aborted || result.state === 'cancelled') break;
      if (result.state === 'failed') { fail('database_unavailable'); break; }
      if (remaining() <= 0) { fail('database_probe_grace_expired'); break; }
      if (result.state === 'ok') {
        if (uncertainSince !== undefined) {
          emit('database_probe_recovered'); diagnostic('recovered');
          episodeId = undefined; firstFailure = null;
        }
        lastHealthy = latest;
        uncertainSince = undefined;
      } else if (result.state === 'transient') {
        if (uncertainSince === undefined) {
          uncertainSince = now();
          emit('database_probe_waiting', result.reason);
          diagnostic('waiting');
        }
      } else { fail('database_unavailable'); break; }
    }
  } catch {
    if (!signal.aborted) fail('database_unavailable');
  } finally {
    if (episodeId && !terminal && signal.aborted) diagnostic('cancelled');
  }
  return { joined: true };
}
