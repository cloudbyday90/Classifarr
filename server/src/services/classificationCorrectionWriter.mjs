/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readClassificationOutcomeIdentity } from './classificationOutcomeIdentity.mjs';
import { captureCorrectionDecisionContext } from './classificationDestinationDecision.mjs';

/** The caller owns the history transaction. Event and evidence are always atomic. */
export async function recordClassificationCorrection(client, {
  classification, originalLibraryId, destinationLibraryId, correctedBy,
}) {
  const identityKey = await readClassificationOutcomeIdentity(client, classification);
  const { rows } = await client.query(`
    WITH correction AS (
      INSERT INTO classification_corrections
        (classification_id, original_library_id, corrected_library_id, corrected_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    ), captured AS (
      INSERT INTO classification_correction_outcomes
        (correction_id, media_type, identity_key, selected_library_id, observed_at, decision_context)
      SELECT c.id, $5, $6, c.corrected_library_id, CURRENT_TIMESTAMP, $7::jsonb
      FROM correction c JOIN libraries l ON l.id = c.corrected_library_id
      WHERE $6::text IS NOT NULL AND $5::text IN ('movie', 'tv')
        AND l.is_active IS TRUE AND l.media_type = $5
        AND c.original_library_id IS DISTINCT FROM c.corrected_library_id
        AND c.corrected_by IS NOT NULL AND btrim(c.corrected_by) <> ''
      RETURNING correction_id
    )
    SELECT * FROM correction`, [classification.id, originalLibraryId, destinationLibraryId,
    correctedBy, classification.media_type, identityKey, captureCorrectionDecisionContext(classification)]);
  return rows[0] ?? null;
}

/** Fixed budget per maintenance tick; expired records are also excluded at read time. */
export async function pruneClassificationCorrectionOutcomes(client) {
  const result = await client.query(`
    DELETE FROM classification_correction_outcomes WHERE correction_id IN (
      SELECT correction_id FROM classification_correction_outcomes
      WHERE observed_at <= NOW() - INTERVAL '30 days'
      ORDER BY observed_at, correction_id LIMIT 1000
      FOR UPDATE SKIP LOCKED
    )`);
  return result.rowCount;
}
