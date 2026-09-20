/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Own exactly one disposable container, even if cancellation arrives during creation. */
export async function runOwnedInventoryBenchmark(plan, docker, { signal } = {}) {
  let started = false, stopPromise, logFollower, exitCode, failure;
  const deadline = AbortSignal.timeout(plan.timeoutMs);
  const cancellation = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const stop = () => {
    if (started && !stopPromise) stopPromise = docker.stop().catch(() => {});
    // A failed graceful stop is followed by verified force-removal in finally.
  };
  cancellation.addEventListener('abort', stop);
  try {
    cancellation.throwIfAborted();
    // Do not abandon startup on abort: the daemon may still be creating the container.
    await docker.start();
    started = true;
    if (cancellation.aborted) stop();
    else logFollower = docker.follow();
    exitCode = await docker.wait(cancellation);
    if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) throw new Error('inventory_benchmark_exit_invalid');
  } catch (error) { failure = error; }
  finally {
    cancellation.removeEventListener('abort', stop);
    await stopPromise;
    try { await logFollower?.close(); } catch (error) { failure ??= error; }
    // Also clean up after ambiguous/failed startup, by exact name AND ownership label.
    try { await docker.remove(); } catch { throw new Error(`inventory_benchmark_cleanup_failed:${plan.name}`); }
  }
  if (cancellation.aborted) return signal?.aborted ? 130 : 124;
  if (failure) throw failure;
  return exitCode;
}
