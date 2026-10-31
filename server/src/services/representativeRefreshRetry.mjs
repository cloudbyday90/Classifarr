/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_REFRESH_STORAGE_RETRY_MS } from './inventoryRefreshDatabaseFailure.mjs';

/** Eligibility only: no timers, admission bypass or reset of genuine failure history on deferral. */
export function createRepresentativeRefreshRetry({ now = Date.now } = {}) {
  let resourceUntil = 0, failureUntil = 0, storageUntil = 0, failures = 0;
  return {
    isCoolingDown: () => now() < Math.max(resourceUntil, failureUntil, storageUntil),
    defer() { resourceUntil = now() + 60_000; },
    fail({ storageFailure = false } = {}) {
      failures = Math.min(failures + 1, 7);
      const failedAt = now();
      failureUntil = failedAt + Math.min(3_600_000, 60_000 * 2 ** (failures - 1));
      if (storageFailure) storageUntil = Math.max(storageUntil, failedAt + INVENTORY_REFRESH_STORAGE_RETRY_MS);
    },
    reset({ preserveStorage = false } = {}) {
      resourceUntil = 0; failureUntil = 0; failures = 0;
      if (!preserveStorage) storageUntil = 0;
    },
  };
}
