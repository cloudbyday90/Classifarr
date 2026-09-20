/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { buildClassificationCandidateCapture } from './classificationCandidateCapture.mjs';

export const INVENTORY_TRAINING_HISTORY_SQL = `SELECT input.media_type, input.tmdb_id
  FROM unnest($1::text[], $2::integer[]) AS input(media_type, tmdb_id)
  WHERE EXISTS (SELECT 1 FROM classification_history h
    WHERE h.media_type=input.media_type AND h.tmdb_id=input.tmdb_id
      AND NOT COALESCE(h.method='source_library'
        AND h.reason IS DISTINCT FROM 'Resolved via library placement'
        AND (h.metadata #> '{classification_details,candidate_capture}' IS NULL
          OR h.metadata #> '{classification_details,candidate_capture}' = $3::jsonb), false))
  ORDER BY input.media_type, input.tmdb_id LIMIT 50001`;

/** Exclude decisions/unknown origins, not source-library observation history. Neither absence nor legacy observations prove independent placement. */
export async function readInventoryTrainingExclusions(client, documents) {
  if (!Array.isArray(documents) || documents.length > 50000) throw new Error('inventory_training_provenance_budget');
  const identities = new Map();
  for (const doc of documents) {
    const identity = inventoryDescriptionIdentity({ media_type: doc.type, tmdb_id: doc.id });
    if (identity !== doc.key) throw new Error('inventory_training_provenance_identity');
    identities.set(identity, { type: doc.type, id: doc.id });
  }
  if (!identities.size) return new Set();
  const inputs = [...identities.values()];
  const { rows } = await client.query(INVENTORY_TRAINING_HISTORY_SQL, [inputs.map(row => row.type), inputs.map(row => row.id),
    JSON.stringify(buildClassificationCandidateCapture({ method: 'source_library' }))]);
  if (!Array.isArray(rows) || rows.length > identities.size) throw new Error('inventory_training_provenance_result');
  const excluded = new Set();
  for (const row of rows) {
    const identity = inventoryDescriptionIdentity(row);
    if (!identities.has(identity) || excluded.has(identity)) throw new Error('inventory_training_provenance_result');
    excluded.add(identity);
  }
  return excluded;
}
