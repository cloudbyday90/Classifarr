/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Eligibility only: no timers, admission bypass or reset of genuine failure history on deferral. */
export function createRepresentativeRefreshRetry({ now = Date.now } = {}) {
  let resourceUntil = 0, failureUntil = 0, failures = 0;
  return {
    isCoolingDown: () => now() < Math.max(resourceUntil, failureUntil),
    defer() { resourceUntil = now() + 60_000; },
    fail() {
      failures = Math.min(failures + 1, 7);
      failureUntil = now() + Math.min(3_600_000, 60_000 * 2 ** (failures - 1));
    },
    reset() { resourceUntil = 0; failureUntil = 0; failures = 0; },
  };
}
