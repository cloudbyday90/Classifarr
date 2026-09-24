/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { captureCorrectionDecisionContext, readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';

const VERSION = 'classification.feedback_outcome.v1';
const keys = ['version', 'mediaType', 'tmdbId', 'selectedLibraryId', 'decisionContext'];
const integer = value => typeof value === 'number' && positiveDatabaseInteger(value) !== null;

export function readFeedbackOutcomeSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length ||
      !keys.every(key => Object.hasOwn(value, key)) || value.version !== VERSION ||
      !['movie', 'tv'].includes(value.mediaType) || !integer(value.tmdbId) || !integer(value.selectedLibraryId)) return null;
  const context = value.decisionContext === null ? null : readCorrectionDecisionContext(value.decisionContext);
  if (value.decisionContext !== null && (!context || context.capture.mediaType !== value.mediaType ||
      context.capture.tmdbId !== value.tmdbId)) return null;
  return { version: VERSION, mediaType: value.mediaType, tmdbId: value.tmdbId,
    selectedLibraryId: value.selectedLibraryId, decisionContext: context };
}

/** Only the locked source row and validated explicit selection can produce this snapshot. */
export function buildFeedbackOutcomeSnapshot(classification, selectedLibraryId) {
  if (!classification) return null;
  return readFeedbackOutcomeSnapshot({ version: VERSION, mediaType: classification.media_type,
    tmdbId: positiveDatabaseInteger(classification.tmdb_id), selectedLibraryId: positiveDatabaseInteger(selectedLibraryId),
    decisionContext: captureCorrectionDecisionContext(classification) });
}

/** Expire evidence, never the replay-blocking receipt. Replays cannot refresh retention. */
export async function pruneFeedbackOutcomeSnapshots(client) {
  const result = await client.query(`
    UPDATE policy_feedback_sources SET outcome_snapshot = NULL WHERE classification_id IN (
      SELECT classification_id FROM policy_feedback_sources
      WHERE outcome_snapshot IS NOT NULL AND created_at <= NOW() - INTERVAL '30 days'
      ORDER BY created_at, classification_id LIMIT 1000 FOR UPDATE SKIP LOCKED
    )`);
  return result.rowCount;
}
