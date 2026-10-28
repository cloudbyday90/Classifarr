/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { authorizedCorrectionSnapshotExists } from './authorizedOutcomeEvaluationQuery.mjs';

/** Fixed ch/authorized aliases; unbound legacy rows are guards, never guessed labels. */
export const INVENTORY_PROSPECTIVE_LEGACY_OUTCOMES_SQL = `
  SELECT jsonb_build_object('origin', 'retained_correction', 'classification_id', ch.classification_id::text,
    'event_classification_id', cc.classification_id::text, 'media_type', c.media_type, 'identity_key', c.identity_key,
    'selected_library_id', c.selected_library_id, 'was_correction', true, 'observed_at', c.observed_at,
    'decision_context', CASE WHEN octet_length(c.decision_context::text) <= 1024 THEN c.decision_context
      WHEN c.decision_context IS NOT NULL THEN '{"oversized":true}'::jsonb END,
    'target_available', l.is_active IS TRUE AND l.media_type = c.media_type) AS observation
  FROM classification_correction_outcomes c
  LEFT JOIN classification_corrections cc ON cc.id = c.correction_id
  LEFT JOIN libraries l ON l.id = c.selected_library_id
  WHERE c.observed_at > NOW() - INTERVAL '30 days' AND c.observed_at <= NOW()
    AND (cc.classification_id = ch.classification_id
      OR c.decision_context->>'classificationId' = ch.classification_id::text
      OR (cc.classification_id IS NULL AND c.decision_context->>'classificationId' IS NULL AND (c.identity_key = ch.capture->>'identityKey'
        OR c.identity_key = ch.media_type || ':' || ch.tmdb_id::text)))
    AND NOT ${authorizedCorrectionSnapshotExists('c.correction_id')}
  UNION ALL
  SELECT jsonb_build_object('origin', 'legacy_feedback', 'classification_id', r.classification_id::text,
    'intake', r.intake, 'observed_at', r.created_at, 'feedback_snapshot',
    CASE WHEN octet_length(r.outcome_snapshot::text) <= 2048 THEN r.outcome_snapshot
      WHEN r.outcome_snapshot IS NOT NULL THEN '{"oversized":true}'::jsonb END,
    'target_available', l.is_active IS TRUE AND l.media_type = r.outcome_snapshot->>'mediaType')
  FROM policy_feedback_sources r
  LEFT JOIN libraries l ON l.id::text = r.outcome_snapshot->>'selectedLibraryId'
  WHERE r.classification_id = ch.classification_id
    AND r.created_at > NOW() - INTERVAL '30 days' AND r.created_at <= NOW()
  UNION ALL
  SELECT jsonb_build_object('origin', 'unverified_correction', 'classification_id', cc.classification_id::text,
    'observed_at', cc.created_at AT TIME ZONE current_setting('TimeZone'))
  FROM classification_corrections cc
  WHERE cc.classification_id = ch.classification_id AND isfinite(cc.created_at)
    AND cc.created_at > CURRENT_TIMESTAMP::timestamp - INTERVAL '30 days'
    AND cc.created_at <= CURRENT_TIMESTAMP::timestamp
    AND NOT EXISTS (SELECT 1 FROM classification_correction_outcomes c WHERE c.correction_id = cc.id)
    AND NOT EXISTS (SELECT 1 FROM policy_authorized_outcome_source_event_receipts r
      WHERE r.source_id = 'manual_classification_change'
        AND r.source_event_id = 'classification_correction:' || cc.id::text
        AND r.final_outcome_status_id IN ('resolved', 'routed')
        AND r.created_at > NOW() - INTERVAL '30 days' AND r.created_at <= NOW())
`;
