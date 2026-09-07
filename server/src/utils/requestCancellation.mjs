/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Reject caller cancellation without exposing its arbitrary reason or cause. */
export function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  throw Object.assign(new Error('Request cancelled'), { name: 'AbortError', code: 'ABORT_ERR' });
}

/**
 * Keep the first abort source stable even when both signals eventually abort.
 * Native composition owns listener cleanup; null is an existing adapter default.
 * @param {number} timeout
 * @param {AbortSignal | null} [callerSignal]
 */
export function createRequestCancellation(timeout, callerSignal) {
  const deadline = AbortSignal.timeout(timeout);
  const signal = callerSignal == null ? deadline : AbortSignal.any([callerSignal, deadline]);

  function throwIfAborted() {
    if (!signal.aborted) return;
    if (deadline.aborted && signal.reason === deadline.reason) {
      throw Object.assign(new Error(deadline.reason.message), {
        code: 'ETIMEDOUT', cause: deadline.reason,
      });
    }
    throwIfCancelled(signal);
  }

  throwIfAborted();
  return { signal, throwIfAborted };
}
