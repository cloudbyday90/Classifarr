/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

/** Diagnostic timing only; never changes the production retry clock. */
export function createComparisonStudyTiming({ elapsed = false, wait = delay,
  monotonic = () => performance.now(), wallClock = Date.now } = {}) {
  let clock = 1_000_000;
  return {
    now: elapsed ? wallClock : () => clock,
    async beforeCycle(cycle) {
      if (!elapsed) { clock += 300_001; return; }
      if (cycle === 0) return;
      const deadline = monotonic() + 300_001;
      // Recheck elapsed time; an early-resolving wait must not fake a cooldown.
      while (monotonic() < deadline) await wait(Math.min(30_000, deadline - monotonic()));
    },
  };
}
