/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as sleep } from 'node:timers/promises';
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';

export function readDatabaseStartupTimeout(environment = process.env) {
  const value = environment.CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS ?? environment.PGCTLTIMEOUT ?? '300';
  if (!/^[1-9]\d{0,3}$/.test(value) || Number(value) > 1800) {
    throw new Error('database_startup_timeout_invalid');
  }
  return Number(value) * 1000;
}

/** One launch, one finite budget. Progress never renews the deadline. */
export async function runEmbeddedDatabaseStartup({
  launch, probe, timeoutMs = 300_000, signal, report = () => {},
  now = () => performance.now(), delay = sleep, waitForExit = waitForEmbeddedExit,
}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 1_800_000) {
    throw new Error('database_startup_timeout_invalid');
  }
  const started = now();
  const probeController = new AbortController();
  let child;
  let timer;
  let wakeAbort;
  let lastReport = -Infinity;
  let lastPhase;
  const cancelled = new Promise(resolve => { wakeAbort = () => resolve({ kind: 'cancelled' }); });
  const expired = new Promise(resolve => { timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs); });
  signal?.addEventListener('abort', wakeAbort, { once: true });
  const inspectDeadline = () => {
    if (signal?.aborted) throw new Error('database_startup_cancelled');
    if (now() - started >= timeoutMs) throw new Error('database_startup_timeout');
    if (child?.hasExited()) throw new Error('database_startup_process_exited');
  };
  try {
    inspectDeadline();
    child = launch();
    const exited = child.done.then(() => ({ kind: 'exited' }));
    const step = async operation => {
      const result = await Promise.race([
        operation.then(value => ({ kind: 'value', value })), exited, cancelled, expired,
      ]);
      if (result.kind !== 'value') {
        throw new Error(`database_startup_${result.kind === 'exited' ? 'process_exited' : result.kind}`);
      }
      inspectDeadline();
      return result.value;
    };
    report({ status: 'starting', timeoutSeconds: timeoutMs / 1000 });
    while (true) {
      inspectDeadline();
      const state = await step(probe(child.pid, probeController.signal));
      const elapsedMs = now() - started;
      if (state.ready === true) {
        report({ status: 'ready', elapsedSeconds: Math.floor(elapsedMs / 1000) });
        return;
      }
      if (state.phase !== lastPhase || elapsedMs - lastReport >= 15_000) {
        report({ status: 'waiting', phase: state.phase, elapsedSeconds: Math.floor(elapsedMs / 1000),
          remainingSeconds: Math.ceil((timeoutMs - elapsedMs) / 1000) });
        lastReport = elapsedMs;
        lastPhase = state.phase;
      }
      await step(delay(Math.min(1000, timeoutMs - elapsedMs), undefined, { signal: probeController.signal }));
    }
  } catch (error) {
    probeController.abort();
    // Codes only: PostgreSQL's own log contains diagnostics, not arbitrary
    // command output or environment values in application status messages.
    const reason = /^database_startup_[a-z_]+$/.test(error.message) ? error.message : 'database_startup_probe_failed';
    report({ status: 'failed', reason });
    if (child && !child.hasExited()) {
      try {
        child.signal('SIGINT'); // PostgreSQL fast shutdown; never SIGKILL.
        await waitForExit(child.done, 20_000);
        report({ status: 'process_stopped' });
      } catch { report({ status: 'shutdown_unconfirmed' }); }
    }
    throw error;
  } finally {
    probeController.abort();
    clearTimeout(timer);
    signal?.removeEventListener('abort', wakeAbort);
    // Success hands the live server to the existing supervisor. Failure does
    // not pretend an unconfirmed shutdown was clean; the container must fail.
    child?.detach();
  }
}
