/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';
import { observeProbe } from './embeddedProbeDiagnostics.mjs';

const transientReasons = new Set(['database_probe_timeout', 'database_probe_resource_pressure']);

/** One check, including identity reads, with bounded cancellation and join. */
export async function probeEmbeddedDatabase(check, {
  signal, timeoutMs = 3000, joinMs = 1000, now = () => performance.now(), observe,
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 3000
    || !Number.isFinite(joinMs) || joinMs <= 0 || joinMs > 1000) throw new Error('database_probe_budget_invalid');
  if (signal?.aborted) return { state: 'cancelled', joined: true };
  const controller = new AbortController();
  const started = now();
  let timer, cancel;
  const aborted = new Promise(resolve => { cancel = () => resolve({ state: 'cancelled' }); });
  const expired = new Promise(resolve => { timer = setTimeout(() => resolve({ state: 'timeout' }), timeoutMs); });
  signal?.addEventListener('abort', cancel, { once: true });
  const operation = Promise.resolve().then(() => {
    controller.signal.throwIfAborted();
    return check({ signal: controller.signal, observe });
  }).then(() => ({ state: 'ok' }), error => ({ state: 'error', error }));
  const finish = result => { observeProbe(observe, 'outcome', result); return result; };
  try {
    let result = await Promise.race([operation, aborted, expired]);
    if (signal?.aborted) result = { state: 'cancelled' };
    // Reject a late success even when its callback beats an overdue timer.
    else if (now() - started >= timeoutMs && result.state === 'ok') result = { state: 'timeout' };
    if (result.state === 'cancelled' || result.state === 'timeout') {
      if (result.state === 'timeout') observeProbe(observe, 'deadline');
      observeProbe(observe, 'join_start');
      controller.abort();
      let settled;
      try { settled = await waitForEmbeddedExit(operation, joinMs); }
      catch { return finish({ state: 'unjoined', joined: false }); }
      if (result.state === 'cancelled') return finish({ state: 'cancelled', joined: true });
      // A concrete identity/permission/death failure discovered while joining
      // takes precedence over an inferred timeout. Our own abort is expected.
      if (settled.state === 'error' && settled.error?.name !== 'AbortError'
        && !transientReasons.has(settled.error?.code)) return finish({ state: 'failed', joined: true });
      return finish({ state: 'transient', reason: 'database_probe_timeout', joined: true });
    }
    if (result.state === 'error') {
      return finish(transientReasons.has(result.error?.code)
        ? { state: 'transient', reason: result.error.code, joined: true }
        : { state: 'failed', joined: true });
    }
    return finish({ state: 'ok', joined: true });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
