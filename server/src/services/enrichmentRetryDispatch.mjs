/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runEnrichmentRetryMaintenance } from './enrichmentRetryMaintenancePass.mjs';
import { hasEnrichmentRetryDispatchCandidate } from './enrichmentRetryDispatchCandidate.mjs';
/** One bounded dispatch per wake-up, not a drain-until-empty loop. */
export async function dispatchEnrichmentRetries(service) {
  const wakeEpoch = service.retryWakeEpoch;
  const upkeep = await runEnrichmentRetryMaintenance(service);
  try {
    for (const type of ['omdb', 'web_search', 'tavily']) {
      if (wakeEpoch !== service.retryWakeEpoch) break;
      const available = await hasEnrichmentRetryDispatchCandidate(service.db, type);
      if (!available || wakeEpoch !== service.retryWakeEpoch) continue;
      const result = await service.processRetryQueue(50, type, { maintenance: false });
      if (result.processed) service.logger.info('Enrichment retry batch processed', { enrichmentType: type, ...result });
    }
  } finally {
    if (upkeep.needsContinuation && wakeEpoch === service.retryWakeEpoch) service.scheduleProcessing(5000);
  }
}
