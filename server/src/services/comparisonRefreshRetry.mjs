/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Scheduler eligibility only; resource refusal never spends or erases genuine failure history. */
export function createComparisonRefreshRetry({ now = Date.now, random = Math.random } = {}) {
  let resourceUntil = 0, failureUntil = 0, failures = 0;
  const clearDeadlines = () => { resourceUntil = 0; failureUntil = 0; };
  return {
    isCoolingDown: (time = now()) => time < Math.max(resourceUntil, failureUntil),
    defer() { resourceUntil = now() + 60_000; },
    fail() {
      failures = Math.min(6, failures + 1);
      const jitter = random();
      failureUntil = now() + Math.min(1_800_000, 60_000 * 2 ** (failures - 1)) *
        (1 + (Number.isFinite(jitter) ? Math.max(0, Math.min(1, jitter)) : 0) * 0.25);
    },
    clearDeadlines,
    reset() { clearDeadlines(); failures = 0; },
  };
}
