/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import cron from 'node-cron';

const TASKS = Object.freeze({
  'inventory-multi-scale-context': { kind: 'comparison', expression: '45 * * * * *', initial: 180_000 },
  'inventory-representative-profile-refresh': { kind: 'representative', expression: '30 * * * * *', initial: 90_000 },
});

/** Real registrations and elapsed cron, without starting unrelated application jobs. */
export function createComparisonStudySchedule({ execute, createTask = cron.schedule,
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  const tasks = [], timers = [], running = new Set(), counts = new Map(), registered = new Set(), initial = new Set();
  let closed = false, failure;
  const invoke = (name, callback) => {
    if (closed) return Promise.resolve();
    const attempt = (counts.get(name) ?? 0) + 1;
    counts.set(name, attempt);
    const pending = Promise.resolve().then(() => {
      assert.ok(attempt <= 60, 'comparison_recovery_callback_budget');
      return execute(TASKS[name].kind, attempt, callback);
    }).catch(error => { failure ??= error; }).finally(() => running.delete(pending));
    running.add(pending); return pending;
  };
  return {
    schedule(name, expression, callback, _interval, options) {
      assert.ok(Object.hasOwn(TASKS, name) && !registered.has(name));
      assert.equal(expression, TASKS[name].expression); assert.equal(options?.noOverlap, true);
      registered.add(name);
      tasks.push(createTask(expression, () => invoke(name, callback), { noOverlap: true }));
    },
    scheduleInitial(name, ms, callback) {
      assert.ok(registered.has(name) && !initial.has(name)); assert.equal(ms, TASKS[name].initial);
      initial.add(name); timers.push(setTimer(() => { void invoke(name, callback); }, ms));
    },
    get active() { return running.size; },
    check() { if (failure) throw failure; },
    async close(stopWorkers) {
      closed = true;
      for (const timer of timers) clearTimer(timer);
      try {
        const stopped = await Promise.allSettled(tasks.map(task => Promise.resolve().then(() => task.destroy())));
        failure ??= stopped.find(result => result.status === 'rejected')?.reason;
      } finally {
        try { stopWorkers(); } catch (error) { failure ??= error; }
        finally { await Promise.all([...running]); }
      }
      if (failure) throw failure;
    },
  };
}
