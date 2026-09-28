/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

/** No refill, evaluation, restart or forced GC during the settled observation. */
export async function observeStudyIdle({ durationMs, readBacklog, sample, now = () => performance.now(), wait = delay }) {
  if (!Number.isSafeInteger(durationMs) || durationMs < 10000 || durationMs > 120000) throw new Error('resource_study_idle_invalid');
  let start, completed;
  for (let count = 0; count < 80; count++) {
    const backlog = await readBacklog();
    completed ??= backlog?.completed;
    if (!backlog || !Number.isSafeInteger(completed) || completed < 1 || backlog.pending !== 0 || backlog.failed !== 0 ||
      backlog.routing !== 0 || backlog.oldestPendingSeconds !== 0 || backlog.completed !== completed) {
      throw new Error('resource_study_idle_not_settled');
    }
    await sample('idle', backlog);
    start ??= now();
    if (now() - start > durationMs + 30000) throw new Error('resource_study_idle_deadline');
    if (now() - start >= durationMs && count >= 5) return;
    await wait(2000);
  }
  throw new Error('resource_study_idle_deadline');
}
