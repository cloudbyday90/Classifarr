/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildManualRoutingIntent } from './manualRoutingIntent.mjs';
import { MANUAL_ROUTING_PENDING } from './queueManualRoutingOutcome.mjs';

export async function captureManualRoutingIntent(db, selection, input) {
  const intent = buildManualRoutingIntent(input);
  const result = await db.query(`UPDATE classification_history
    SET metadata=jsonb_set(metadata,'{classification_details,manual_routing_intent}',
      $1::jsonb || jsonb_build_object('libraryId',library_id,'mediaType',media_type,'tmdbId',tmdb_id))
    WHERE id=$2 AND library_id=$3 AND method='manual_classification' AND status='completed'
      AND metadata->'classification_details'->>'manual_routing_attempt_id'=$4
      AND metadata->'classification_details'->>'routing'=$5
      AND NOT (metadata->'classification_details' ? 'manual_routing_intent')`,
  [JSON.stringify(intent), selection.classificationId, selection.library.id, selection.attemptId, MANUAL_ROUTING_PENDING]);
  if (result.rowCount !== 1) throw new Error('Manual routing intent could not be saved');
}
