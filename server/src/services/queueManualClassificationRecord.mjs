/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { buildNonClassifierHistoryMetadata } from './nonClassifierHistoryMetadata.mjs';
import { MANUAL_ROUTING_PENDING, MANUAL_ROUTING_MESSAGE } from './queueManualRoutingOutcome.mjs';

/** Only local SQL and pure preparation belong inside this transaction. */
export async function saveManualClassification(client, { taskId, libraryId, resolvedBy, parsePayload, extract }) {
  const { rows: [task] } = await client.query('SELECT * FROM task_queue WHERE id=$1 FOR UPDATE', [taskId]);
  if (!task) return { success: false, code: 'task_not_found' };
  if (task.task_type !== 'classification') return { success: false, code: 'invalid_task_type', taskType: task.task_type };
  if (task.status !== 'pending') return { success: false, code: 'invalid_state', currentStatus: task.status };
  const { rows: [library] } = await client.query('SELECT * FROM libraries WHERE id=$1 AND is_active IS TRUE', [libraryId]);
  if (!library) return { success: false, code: 'library_not_found' };
  const payload = parsePayload(task.payload);
  const metadata = payload.media || payload.metadata || payload;
  const mediaType = metadata.media_type || library.media_type;
  if (!['movie', 'tv'].includes(mediaType) || mediaType !== library.media_type) {
    return { success: false, code: 'invalid_media_type' };
  }
  const title = metadata.title || payload.title || 'Unknown';
  const graph = extract(metadata), attemptId = randomUUID();
  const history = buildNonClassifierHistoryMetadata(metadata, 'manual_classification');
  history.classification_details = { ...history.classification_details,
    routing: MANUAL_ROUTING_PENDING, routing_error: MANUAL_ROUTING_MESSAGE, manual_routing_attempt_id: attemptId };
  // A new manual observation must not inherit a previous operation's success.
  delete history.classification_details.outcome_link;
  delete history.classification_details.outcome_path;
  delete history.classification_details.manual_routing_intent;
  delete history.classification_details.manual_routing_observation;
  const { rows: [inserted] } = await client.query(`INSERT INTO classification_history
    (tmdb_id,media_type,title,year,library_id,library_name,confidence,method,reason,metadata,status,
     director_name,primary_studio_name,genre_names,cast_ids,cast_names)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
  [metadata.tmdb_id || payload.tmdb_id || null, mediaType, title, metadata.year || payload.year || null,
    libraryId, library.name, 100, 'manual_classification', `Manually classified by ${resolvedBy}`,
    JSON.stringify(history), 'completed', graph.director_name, graph.primary_studio_name,
    graph.genre_names, graph.cast_ids, graph.cast_names]);
  await client.query("UPDATE task_queue SET status='completed',completed_at=NOW() WHERE id=$1", [taskId]);
  return { success: true, classificationId: inserted.id, library, metadata, attemptId };
}
