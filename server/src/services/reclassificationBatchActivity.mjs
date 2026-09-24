/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { ValidationError } from '../utils/appError.mjs';

const PAGE_SIZE = 10;

export async function getBatchActivity(after, database = db) {
  let priority = -1;
  let id = 0;
  if (after !== undefined) {
    if (typeof after !== 'string' || !/^[01]:[1-9][0-9]{0,9}$/.test(after)) {
      throw new ValidationError('Invalid batch activity cursor');
    }
    [priority, id] = after.split(':').map(Number);
    if (id > 2147483647) throw new ValidationError('Invalid batch activity cursor');
  }
  const result = await database.query(`
    WITH candidates AS (
      SELECT id, status, total_items,
        CASE WHEN status IN ('executing', 'paused') THEN 0 ELSE 1 END AS priority
      FROM reclassification_batches
      WHERE started_at IS NOT NULL OR status IN ('executing', 'paused')
    ), page AS (
      SELECT * FROM candidates
      WHERE priority > $1 OR (priority = $1 AND id < $2)
      ORDER BY priority, id DESC LIMIT $3
    )
    SELECT page.*, outcomes.* FROM page CROSS JOIN LATERAL (
      SELECT count(*) FILTER (WHERE item.status = 'completed')::integer AS completed,
        count(*) FILTER (WHERE item.status = 'failed')::integer AS failed,
        count(*) FILTER (WHERE item.status = 'skipped')::integer AS skipped,
        count(*) FILTER (WHERE item.status = 'cancelled')::integer AS cancelled,
        count(*) FILTER (WHERE move.state IN ('moving', 'files_verified'))::integer AS recovering,
        count(*) FILTER (WHERE move.state = 'needs_attention')::integer AS attention
      FROM reclassification_batch_items item
      LEFT JOIN reclassification_move_operations move
        ON move.id = CASE WHEN item.execution_result->>'moveOperationId'
          ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (item.execution_result->>'moveOperationId')::uuid END
        AND move.classification_id = item.classification_id
        AND move.target_library_id = item.target_library_id
      WHERE item.batch_id = page.id
    ) outcomes ORDER BY page.priority, page.id DESC
  `, [priority, id, PAGE_SIZE + 1]);
  const rows = result.rows.slice(0, PAGE_SIZE);
  const last = rows.at(-1);
  return {
    batches: rows.map(row => ({
      id: row.id, status: row.status, total: row.total_items,
      completed: row.completed, failed: row.failed, skipped: row.skipped,
      cancelled: row.cancelled, recovering: row.recovering, attention: row.attention,
    })),
    nextCursor: result.rows.length > PAGE_SIZE ? `${last.priority}:${last.id}` : null,
  };
}
