/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const SCHEDULER_STARTUP_TASKS = Object.freeze([
  Object.freeze({ name: 'gap-analysis', delayMs: 30_000, lockName: 'GAP_ANALYSIS', handlerName: 'runGapAnalysis' }),
  Object.freeze({ name: 'library-watchdog', delayMs: 5_000, lockName: null, handlerName: 'runLibraryWatchdog' }),
  Object.freeze({ name: 'library-sync', delayMs: 120_000, lockName: 'LIBRARY_SYNC', handlerName: 'runPeriodicLibrarySync' }),
  Object.freeze({ name: 'retry-queue', delayMs: 60_000, lockName: 'RETRY_QUEUE', handlerName: 'processRetryQueue' }),
]);

/** Registers core delayed work through the scheduler's cancellable lifecycle. */
export function registerSchedulerStartupTasks(scheduler, { advisoryLocks, handlers } = {}) {
  if (!scheduler || typeof scheduler.scheduleInitial !== 'function' || !advisoryLocks || !handlers) {
    throw new TypeError('Scheduler startup tasks require a scheduler, locks, and handlers.');
  }

  for (const { name, delayMs, lockName, handlerName } of SCHEDULER_STARTUP_TASKS) {
    const handler = handlers[handlerName];
    if (typeof handler !== 'function') throw new TypeError(`Scheduler startup task ${name} requires a handler.`);
    scheduler.scheduleInitial(name, delayMs, handler, lockName ? advisoryLocks[lockName] : null);
  }

  return SCHEDULER_STARTUP_TASKS.length;
}
