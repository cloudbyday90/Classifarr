/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETRY_MAINTENANCE_BATCH_SIZE } from './enrichmentRetryMaintenanceQueries.mjs';

/** One batch per operation. Never drain a backlog inside a scheduler invocation. */
export async function runEnrichmentRetryMaintenance(deps, type = null) {
  const recovered = await deps.recoverStaleProcessingRetries(type);
  const normalized = type === null || type === 'tavily' ? await deps.normalizeTavilyMonthlyDeferredRows() : 0;
  const resolved = await deps.resolveRetriesWithExistingMetadata(type);
  const autoFailed = await deps.failExhaustedPendingRetries(type);
  return { recovered, normalized, resolved, autoFailed,
    needsContinuation: [recovered, normalized, resolved, autoFailed].some(count => count >= RETRY_MAINTENANCE_BATCH_SIZE) };
}
