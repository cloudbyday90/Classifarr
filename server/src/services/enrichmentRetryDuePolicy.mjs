/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Shared read-only expression for claims, dispatch, stats and readiness. No guessed legacy authority.
export const RETRY_EFFECTIVE_DUE_SQL = `CASE WHEN erq.enrichment_type IN ('omdb','web_search','tavily')
  AND erq.retry_wait_until = erq.next_attempt_at
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(erq.retry_wait_context,'[]'::jsonb)) prior
    JOIN enrichment_retry_provider_contexts current ON current.provider_key=prior->>'providerKey'
    WHERE NOT current.credentials_rejected
      AND current.dependency=CASE WHEN erq.enrichment_type='omdb' THEN 'omdb' ELSE 'web_search' END
      AND (current.source<>prior->>'source' OR current.config_id::text<>prior->>'id'
        OR current.generation::text<>prior->>'generation'))
  THEN LEAST(erq.next_attempt_at,'epoch'::timestamptz) ELSE erq.next_attempt_at END`;
