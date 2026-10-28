/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inventoryRankingShadowFixture } from './inventoryRankingShadowFixture.mjs';
import { authorizedEvaluationRow } from '../helpers/authorizedOutcomeEvaluationFixture.mjs';

export function disagreementRow(id = 1, tmdbId = 42, kind = 'correction') {
  const capture = structuredClone(inventoryRankingShadowFixture('movie', tmdbId).capture);
  capture.capturedAt = '2026-10-28T17:57:00.000Z';
  capture.queryHash = BigInt(id).toString(16).padStart(64, '0');
  const context = Number(id) <= 2147483647 ? { classificationId: Number(id), capture: {
    version: 'classification.destination_decision.v1', mediaType: 'movie', tmdbId,
    method: 'ai_analysis', status: 'completed', libraryId: 1 } } : null;
  return { classification_id: id, tmdb_id: tmdbId, media_type: 'movie', capture,
    recorded_at: '2026-10-28T17:58:00.000Z',
    outcomes: [authorizedEvaluationRow({ classification_id: id, tmdb_id: tmdbId, identity_key: `movie:${tmdbId}`,
      observed_at: '2026-10-28T17:59:00.000Z', selected_library_id: kind === 'correction' ? 2 : 1,
      was_correction: kind === 'correction', decision_context: context,
      authorized_snapshot: { snapshot_version: 1, event_key: `classification_correction:${id}`, action_kind: kind,
        snapshot_missing: false, binding_valid: true } })] };
}
export function disagreementInputs(rows = [disagreementRow()]) {
  return { rows, activity: { recorded_movie_tv_events: rows.length }, observedAt: '2026-10-28T18:00:00.000Z',
    window: { since: '2026-09-28T18:00:00.000Z', until: '2026-10-28T18:00:00.000Z' } };
}
export function disagreementFeedback(row, kind = 'confirmation') {
  return { origin: 'legacy_feedback', classification_id: row.classification_id, intake: 'standalone',
    review_id: '2e851bf4-9497-4b99-8b7c-e8117a05c762', review_actor_fingerprint: 'a'.repeat(64),
    observed_at: '2026-10-28T17:59:00.000Z', target_available: true,
    feedback_snapshot: { version: 'classification.feedback_outcome.v3', classificationId: String(row.classification_id),
      mediaType: 'movie', tmdbId: row.tmdb_id, selectedLibraryId: kind === 'confirmation' ? 1 : 2,
      decisionContext: row.outcomes[0].decision_context, action: kind, intake: 'standalone',
      reference: { kind: 'original_automated_destination', libraryId: 1, reviewId: '2e851bf4-9497-4b99-8b7c-e8117a05c762',
        actorFingerprint: 'a'.repeat(64), sourceVersion: 'b'.repeat(64), issuedAt: '2026-10-28T17:58:00.000Z', expiresAt: '2026-10-28T18:08:00.000Z' } } };
}
