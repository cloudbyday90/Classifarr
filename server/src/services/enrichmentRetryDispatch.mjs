/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** One bounded dispatch per wake-up, not a drain-until-empty loop. */
export async function dispatchEnrichmentRetries(service) {
  await service.recoverStaleProcessingRetries();
  for (const type of ['omdb', 'web_search', 'tavily']) {
    const { rows } = await service.db.query(`SELECT id FROM enrichment_retry_queue
      WHERE status = 'pending' AND enrichment_type = $1 AND next_attempt_at <= statement_timestamp()
        AND NOT EXISTS (SELECT 1 FROM enrichment_retry_cooldowns
          WHERE dependency = CASE WHEN $1 = 'omdb' THEN 'omdb' ELSE 'web_search' END
            AND next_attempt_at > statement_timestamp()) LIMIT 1`, [type]);
    if (!rows.length) continue;
    const result = await service.processRetryQueue(50, type);
    if (result.processed) service.logger.info('Enrichment retry batch processed', { enrichmentType: type, ...result });
  }
}
