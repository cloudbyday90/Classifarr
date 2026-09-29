/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETRY_CREDENTIALS_BLOCKED_SQL } from './enrichmentRetryCredentialGate.mjs';
import { runEnrichmentRetryMaintenance } from './enrichmentRetryMaintenancePass.mjs';
/** One bounded dispatch per wake-up, not a drain-until-empty loop. */
export async function dispatchEnrichmentRetries(service) {
  const wakeEpoch = service.retryWakeEpoch;
  const upkeep = await runEnrichmentRetryMaintenance(service);
  try {
    for (const type of ['omdb', 'web_search', 'tavily']) {
      if (wakeEpoch !== service.retryWakeEpoch) break;
      const { rows } = await service.db.query(`SELECT id FROM enrichment_retry_queue
      WHERE status = 'pending' AND enrichment_type = $1 AND next_attempt_at <= statement_timestamp()
        AND NOT ${RETRY_CREDENTIALS_BLOCKED_SQL}
        AND NOT EXISTS (SELECT 1 FROM enrichment_retry_cooldowns
          WHERE dependency = CASE WHEN $1 = 'omdb' THEN 'omdb' ELSE 'web_search' END
            AND next_attempt_at > statement_timestamp()) LIMIT 1`, [type]);
      if (!rows.length || wakeEpoch !== service.retryWakeEpoch) continue;
      const result = await service.processRetryQueue(50, type, { maintenance: false });
      if (result.processed) service.logger.info('Enrichment retry batch processed', { enrichmentType: type, ...result });
    }
  } finally {
    if (upkeep.needsContinuation && wakeEpoch === service.retryWakeEpoch) service.scheduleProcessing(5000);
  }
}
