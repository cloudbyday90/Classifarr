/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETRY_CREDENTIALS_BLOCKED_SQL } from './enrichmentRetryCredentialGate.mjs';
import { RETRY_EFFECTIVE_DUE_SQL } from './enrichmentRetryDuePolicy.mjs';
import { RETRY_MAY_HAVE_WORK_SQL } from './enrichmentRetryAvailability.mjs';
import { retryCandidateParameters } from './enrichmentRetryCandidatePolicy.mjs';

/** Read-only dispatch hint. The batch planner and claim still enforce item eligibility. */
export async function hasEnrichmentRetryDispatchCandidate(db, type) {
  const [validatedType] = retryCandidateParameters(type);
  const {rows} = await db.query(`SELECT erq.id FROM enrichment_retry_queue erq
    WHERE ${RETRY_MAY_HAVE_WORK_SQL}
      AND status = 'pending' AND enrichment_type = $1 AND (${RETRY_EFFECTIVE_DUE_SQL}) <= statement_timestamp()
      AND NOT ${RETRY_CREDENTIALS_BLOCKED_SQL}
      AND NOT EXISTS (SELECT 1 FROM enrichment_retry_cooldowns
        WHERE dependency = CASE WHEN $1 = 'omdb' THEN 'omdb' ELSE 'web_search' END
          AND next_attempt_at > statement_timestamp()) LIMIT 1`, [validatedType]);
  return rows.length > 0;
}
