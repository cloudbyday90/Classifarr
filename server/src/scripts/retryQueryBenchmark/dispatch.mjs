/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { hasEnrichmentRetryDispatchCandidate } from '../../services/enrichmentRetryDispatchCandidate.mjs';
import { RETRY_CREDENTIALS_BLOCKED_SQL } from '../../services/enrichmentRetryCredentialGate.mjs';
import { RETRY_EFFECTIVE_DUE_SQL } from '../../services/enrichmentRetryDuePolicy.mjs';
import { requireRetryBenchmarkSchema } from './schema.mjs';
import { measureRetryQuery } from './measurement.mjs';
import { RETRY_BENCHMARK_TYPES } from './fixture.mjs';

// The pre-change scheduler probe (132d9188). LIMIT 1 never promised an ordered ID.
const BASELINE_SQL = `SELECT erq.id FROM enrichment_retry_queue erq
  WHERE status = 'pending' AND enrichment_type = $1 AND (${RETRY_EFFECTIVE_DUE_SQL}) <= statement_timestamp()
    AND NOT ${RETRY_CREDENTIALS_BLOCKED_SQL}
    AND NOT EXISTS (SELECT 1 FROM enrichment_retry_cooldowns
      WHERE dependency = CASE WHEN $1 = 'omdb' THEN 'omdb' ELSE 'web_search' END
        AND next_attempt_at > statement_timestamp()) LIMIT 1`;

export async function measureRetryDispatch(db, scenario) {
  await requireRetryBenchmarkSchema(db);
  const expected = !['empty','all_waiting','credentials_rejected','legacy_cooldown','provenance_waiting','changed_deadlines'].includes(scenario);
  const measurements = [];
  for (const type of RETRY_BENCHMARK_TYPES) {
    let query;
    await hasEnrichmentRetryDispatchCandidate({query:async (sql,params)=>{query={sql,params};return {rows:[]};}},type);
    for (const [strategy,captured] of [['baseline',{sql:BASELINE_SQL,params:[type]}],['current',query]]) {
      const {rows} = await db.query(captured.sql,captured.params);
      if (rows.length !== Number(expected)) throw new Error('Retry dispatch availability mismatch');
      // All fixture IDs use this provider mapping; unlike pages, the probe does not filter item eligibility.
      if (rows.some(row=>RETRY_BENCHMARK_TYPES[row.id%3]!==type)) throw new Error('Retry dispatch type mismatch');
      const repetitions = [];
      for (let repeat=0;repeat<3;repeat++) repetitions.push(await measureRetryQuery(db,captured));
      measurements.push({type,strategy,available:expected,availabilityVerified:true,repetitions});
    }
  }
  return measurements;
}
