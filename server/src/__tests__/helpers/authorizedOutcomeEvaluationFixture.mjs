/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function authorizedEvaluationRow(overrides = {}) {
  return { media_type: 'movie', tmdb_id: 42, identity_key: 'movie:42', selected_library_id: 2,
    was_correction: true, origin: 'authorized_outcome', observed_at: new Date('2026-10-28T00:00:00Z'),
    classification_id: '1', decision_context: { classificationId: 1,
      capture: { version: 'classification.destination_decision.v1', mediaType: 'movie', tmdbId: 42,
        method: 'ai_analysis', status: 'completed', libraryId: 1 } }, target_available: true,
    authorized_snapshot: { snapshot_version: 1, event_key: 'classification_correction:1', action_kind: 'correction',
      snapshot_missing: false, binding_valid: true }, ...overrides };
}

export function authorizedEvaluationGap() {
  return authorizedEvaluationRow({ media_type: null, tmdb_id: null, identity_key: null, selected_library_id: null,
    was_correction: null, decision_context: null, target_available: false,
    authorized_snapshot: { snapshot_version: null, event_key: 'missing:1', action_kind: null, snapshot_missing: true, binding_valid: null } });
}
