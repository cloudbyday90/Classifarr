/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';

const failure = reason => Object.assign(new Error(`database_operation_${reason}`), { code: `database_operation_${reason}` });

/**
 * Deadline includes all I/O; an abandoned operation never returns success.
 * @param {Function} work
 * @param {{signal?: AbortSignal, timeoutMs?: number, now?: () => number}} [options]
 */
export async function runEmbeddedDatabaseOperation(work, { signal, timeoutMs, now = () => performance.now() } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 25_000) throw failure('budget_invalid');
  if (signal?.aborted) throw failure('cancelled');
  const controller = new AbortController();
  const started = now();
  let timer, cancel;
  const cancelled = new Promise(resolve => { cancel = () => resolve({ reason: 'cancelled' }); });
  const expired = new Promise(resolve => { timer = setTimeout(() => resolve({ reason: 'timeout' }), timeoutMs); });
  signal?.addEventListener('abort', cancel, { once: true });
  const operation = Promise.resolve().then(() => {
    controller.signal.throwIfAborted();
    return work(controller.signal);
  }).then(value => ({ value }), error => ({ error }));
  try {
    let result = await Promise.race([operation, cancelled, expired]);
    if (signal?.aborted) result = { reason: 'cancelled' };
    else if (now() - started >= timeoutMs) result = { reason: 'timeout' };
    if (result.reason) {
      controller.abort();
      try { await waitForEmbeddedExit(operation, 1000); }
      catch { throw failure('unjoined'); }
      throw failure(result.reason);
    }
    if ('error' in result) throw result.error;
    return result.value;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
