/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const METRIC_COLUMNS = Object.freeze([
  'request_count',
  'structured_parse_success_count',
  'semantic_contract_violation_count',
  'repair_attempt_count',
  'repair_success_count',
  'timeout_or_incomplete_stream_count',
  'model_digest_mismatch_count',
  'hallucinated_library_reference_count',
  'hallucinated_action_count',
  'thinking_trace_leakage_count',
]);

function toSafeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export async function incrementAiProviderCapabilityMetrics(db, delta = {}) {
  const values = [
    delta.providerId,
    delta.model,
    delta.authorityMode,
    toSafeCount(delta.requestCount),
    toSafeCount(delta.structuredParseSuccessCount),
    toSafeCount(delta.semanticContractViolationCount),
    toSafeCount(delta.repairAttemptCount),
    toSafeCount(delta.repairSuccessCount),
    toSafeCount(delta.timeoutOrIncompleteStreamCount),
    toSafeCount(delta.modelDigestMismatchCount),
    toSafeCount(delta.hallucinatedLibraryReferenceCount),
    toSafeCount(delta.hallucinatedActionCount),
    toSafeCount(delta.thinkingTraceLeakageCount),
  ];

  const updates = METRIC_COLUMNS
    .map(column => `${column} = ai_provider_capability_metrics.${column} + EXCLUDED.${column}`)
    .join(',\n      ');

  await db.query(`
    INSERT INTO ai_provider_capability_metrics (
      provider_id,
      model,
      authority_mode,
      ${METRIC_COLUMNS.join(',\n      ')},
      last_model_digest_mismatch_at,
      last_observed_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      CASE WHEN $10::bigint > 0 THEN NOW() ELSE NULL END,
      NOW()
    )
    ON CONFLICT (provider_id, model, authority_mode)
    DO UPDATE SET
      ${updates},
      last_model_digest_mismatch_at = CASE
        WHEN EXCLUDED.model_digest_mismatch_count > 0 THEN NOW()
        ELSE ai_provider_capability_metrics.last_model_digest_mismatch_at
      END,
      last_observed_at = NOW()
  `, values);
}
