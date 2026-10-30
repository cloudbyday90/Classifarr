/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AUTHORIZED_OUTCOME_EVALUATION_SQL } from './authorizedOutcomeEvaluationQuery.mjs';

/** A separate population: no inventory ranking shadow or experimental candidate-scope filter. */
export const PURPOSE_OUTCOME_COHORT_SQL = `WITH authorized AS MATERIALIZED (${AUTHORIZED_OUTCOME_EVALUATION_SQL}),
  sources AS MATERIALIZED (
    SELECT a.authorized_snapshot->>'event_key' AS event_key,a.classification_id,a.observed_at,'authorized'::text AS origin,
      to_jsonb(a)||jsonb_build_object('classification_id',a.classification_id::text,'source_id',a.source_id::text) AS source
    FROM authorized a
    UNION ALL
    SELECT 'feedback_review:'||f.classification_id::text,f.classification_id,f.created_at,'feedback',
      jsonb_build_object('classification_id',f.classification_id::text,'feedback_id',f.feedback_id,'intake',f.intake,
        'review_id',f.review_id::text,'review_actor_fingerprint',f.review_actor_fingerprint,
        'snapshot',CASE WHEN octet_length(f.outcome_snapshot::text)<=4096 THEN f.outcome_snapshot END,
        'target_available',EXISTS(SELECT 1 FROM libraries l WHERE l.id::text=f.outcome_snapshot->>'selectedLibraryId'
          AND l.media_type=f.outcome_snapshot->>'mediaType' AND l.is_active=true))
    FROM policy_feedback_sources f WHERE f.created_at>=$1::timestamptz AND f.created_at<$2::timestamptz
  ), bounded AS MATERIALIZED (
    SELECT * FROM sources WHERE observed_at>=$1::timestamptz AND observed_at<$2::timestamptz
    ORDER BY observed_at,classification_id,event_key LIMIT 5001
  ), audit_rows AS MATERIALIZED (
    SELECT b.event_key,b.classification_id::text,b.observed_at,
      (extract(epoch FROM b.observed_at)*1000000)::bigint::text AS observed_order,b.origin,b.source,
      c.identity_key AS holdout_identity,
      CASE WHEN s.event_key IS NOT NULL THEN (to_jsonb(s)-'payload')||jsonb_build_object(
        'classification_id',s.classification_id::text,'authorized_receipt_id',s.authorized_receipt_id::text,
        'feedback_classification_id',s.feedback_classification_id::text,
        'payload',CASE WHEN s.expires_at>$2::timestamptz AND s.expired_at IS NULL AND octet_length(s.payload::text)<=4096 THEN s.payload END)
      END AS supplement
    FROM bounded b LEFT JOIN policy_purpose_outcome_supplements s ON s.event_key=b.event_key
    LEFT JOIN classification_policy_evaluation_captures c ON c.classification_id=b.classification_id
  ), budget AS (SELECT COUNT(*)::int AS events,COALESCE(SUM(octet_length(to_jsonb(r)::text)),0)::text AS payload_bytes FROM audit_rows r)
  SELECT to_jsonb(r) AS input,b.events,b.payload_bytes FROM audit_rows r CROSS JOIN budget b
    WHERE b.events<=5000 AND b.payload_bytes::bigint<=67108864
  UNION ALL SELECT NULL,b.events,b.payload_bytes FROM budget b
    WHERE b.events=0 OR b.events>5000 OR b.payload_bytes::bigint>67108864`;
