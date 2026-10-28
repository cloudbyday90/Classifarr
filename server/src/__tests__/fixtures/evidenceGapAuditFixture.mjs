/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inventoryRankingShadowFixture } from './inventoryRankingShadowFixture.mjs';
import { authorizedEvaluationRow } from '../helpers/authorizedOutcomeEvaluationFixture.mjs';
import { buildEvidenceGapAudit } from '../../services/evidenceGapAuditProjection.mjs';

export function gapAuditRow(id = 1) {
  const capture = structuredClone(inventoryRankingShadowFixture('movie', id + 40).capture);
  capture.capturedAt = '2026-10-28T11:00:00.000Z'; capture.queryHash = id.toString(16).padStart(64, '0');
  return { classification_id: String(id), tmdb_id: id + 40, media_type: 'movie', capture,
    recorded_at: capture.capturedAt, outcomes: [authorizedEvaluationRow({ classification_id: String(id), tmdb_id: id + 40,
      identity_key: capture.identityKey, decision_context: null, observed_at: '2026-10-28T11:30:00.000Z',
      authorized_snapshot: { ...authorizedEvaluationRow().authorized_snapshot, event_key: `classification_correction:${id}` } })] };
}
export function gapAuditSnapshot(rows = [], recorded = rows.length) {
  const observedAt = '2026-10-28T12:00:00.000Z';
  return { observedAt, inputs: { observedAt, window: { since: '2026-09-28T12:00:00.000Z', until: observedAt },
    rows, activity: { recorded_movie_tv_events: recorded } } };
}
export const gapAuditReport = () => buildEvidenceGapAudit(gapAuditSnapshot().inputs);
