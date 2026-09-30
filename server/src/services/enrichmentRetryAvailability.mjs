/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// A conservative, statement-local negative check, not an eligibility decision.
// Any matching wait provenance keeps the full query alive, even before rotation.
// Keep the static predicate identical to idx_enrichment_retry_wait_provenance.
export const RETRY_MAY_HAVE_WORK_SQL = `(EXISTS (
  SELECT 1 FROM enrichment_retry_queue due
  WHERE due.status = 'pending' AND due.enrichment_type = $1
    AND due.next_attempt_at <= statement_timestamp()
) OR EXISTS (
  SELECT 1 FROM enrichment_retry_queue waiting
  WHERE waiting.status = 'pending' AND waiting.enrichment_type = $1
    AND waiting.retry_wait_context IS NOT NULL
    AND waiting.retry_wait_until = waiting.next_attempt_at
))`;
