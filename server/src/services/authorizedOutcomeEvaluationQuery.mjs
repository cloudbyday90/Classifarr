/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Private frozen evidence only. No join to current classification history. */
export const AUTHORIZED_OUTCOME_EVALUATION_SQL = `
  SELECT DISTINCT ON (event_key, media_type, identity_key, selected_library_id, action_kind, decision_context, binding_valid)
    media_type, CASE WHEN identity_key LIKE 'source:%' THEN NULL
      ELSE split_part(identity_key, ':', 2)::integer END AS tmdb_id,
    identity_key, selected_library_id, action_kind = 'correction' AS was_correction,
    'authorized_outcome'::text AS origin, observed_at, source_id, classification_id,
    decision_context, target_available,
    jsonb_build_object('snapshot_version', snapshot_version, 'event_key', event_key,
      'action_kind', action_kind, 'snapshot_missing', snapshot_missing, 'binding_valid', binding_valid) AS authorized_snapshot
  FROM (
    SELECT s.media_type, s.identity_key, s.selected_library_id, s.action_kind, s.snapshot_version,
      s.decision_context, r.classification_id, r.id AS source_id, COALESCE(s.observed_at, r.created_at) AS observed_at,
      COALESCE(s.event_key, 'missing:' || r.id::text) AS event_key,
      s.receipt_id IS NULL AS snapshot_missing,
      CASE WHEN s.receipt_id IS NULL THEN NULL ELSE
        s.selected_library_id = r.destination_library_id AND CASE WHEN r.source_id = 'manual_classification_change'
          THEN s.observed_at = r.created_at AND s.event_key = r.source_event_id
          ELSE s.observed_at <= r.created_at
            AND split_part(r.source_event_id, ':', 2) = r.classification_id::text
            AND (r.source_event_id ~ '^runtime_exact_item_memory:[1-9][0-9]*:[A-Za-z0-9_-]{22}$'
              OR r.source_event_id ~ '^runtime_destination_evidence:[1-9][0-9]*:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{22}$')
            AND s.event_key = 'runtime_resolution:' || r.classification_id::text || ':' || split_part(r.source_event_id, ':', 3)
        END END AS binding_valid,
      (l.is_active IS TRUE AND l.media_type = s.media_type) AS target_available
    FROM policy_authorized_outcome_source_event_receipts r
    LEFT JOIN policy_authorized_outcome_evaluation_snapshots s ON s.receipt_id = r.id
      AND s.observed_at > NOW() - INTERVAL '30 days' AND s.observed_at <= NOW()
    LEFT JOIN libraries l ON l.id = s.selected_library_id
    WHERE r.source_id IN ('manual_classification_change', 'operator_confirmation')
      AND r.final_outcome_status_id IN ('resolved', 'routed')
      AND r.created_at > NOW() - INTERVAL '30 days' AND r.created_at <= NOW()
  ) authorized_evidence
  ORDER BY event_key, media_type, identity_key, selected_library_id, action_kind, decision_context, binding_valid, observed_at, source_id
`;

/** Prefer a captured authorized representation, including an unavailable target. */
export function authorizedCorrectionSnapshotExists(correctionId) {
  if (!['o.correction_id', 'cc.id', 'c.correction_id'].includes(correctionId)) throw new Error('authorized_evaluation_invalid_sql_alias');
  return `EXISTS (
  SELECT 1 FROM policy_authorized_outcome_source_event_receipts ar
  JOIN policy_authorized_outcome_evaluation_snapshots ae ON ae.receipt_id = ar.id
  WHERE ar.source_id = 'manual_classification_change'
    AND ar.source_event_id = 'classification_correction:' || ${correctionId}::text
    AND ar.final_outcome_status_id IN ('resolved', 'routed')
    AND ar.created_at > NOW() - INTERVAL '30 days' AND ar.created_at <= NOW()
)`;
}
