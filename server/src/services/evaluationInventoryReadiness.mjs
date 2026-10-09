/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_BACKGROUND_READINESS_SQL } from './inventoryBackgroundReadiness.mjs';

const statuses = new Set(['disabled', 'waiting_for_libraries', 'ingesting', 'waiting_for_inventory', 'backfilling', 'ready']);
const countKeys = ['completedImports', 'notStarted', 'scanning', 'completedHandoffs', 'dueTasks', 'processingTasks'];

const progressSql = `WITH completed_imports AS MATERIALIZED (
  SELECT s.backfill_run_id IS NOT DISTINCT FROM s.run_id AS current_run,
    s.backfill_after_id, s.backfill_completed_at, s.backfill_updated_at
  FROM library_ingestion_state s JOIN libraries l ON l.id=s.library_id
  LEFT JOIN media_server ms ON ms.id=l.media_server_id
  WHERE s.phase='complete' AND l.is_active AND l.media_type IN ('movie','tv')
    AND (l.media_server_id IS NULL OR ms.is_active)
)
SELECT count(*)::int AS "completedImports",
  count(*) FILTER (WHERE NOT current_run OR (backfill_completed_at IS NULL AND backfill_after_id=0))::int AS "notStarted",
  count(*) FILTER (WHERE current_run AND backfill_completed_at IS NULL AND backfill_after_id>0)::int AS scanning,
  count(*) FILTER (WHERE current_run AND backfill_completed_at IS NOT NULL)::int AS "completedHandoffs",
  max(backfill_updated_at) FILTER (WHERE current_run AND backfill_completed_at IS NULL AND backfill_after_id>0)::text AS "latestCheckpointAt",
  (SELECT count(*)::int FROM task_queue WHERE status='pending'
    AND (next_retry_at IS NULL OR next_retry_at<=statement_timestamp())) AS "dueTasks",
  (SELECT count(*)::int FROM task_queue WHERE status='processing') AS "processingTasks"
FROM completed_imports`;

// One statement keeps both due-task checks on the same statement clock.
export const EVALUATION_INVENTORY_READINESS_SQL = `WITH admission AS (${INVENTORY_BACKGROUND_READINESS_SQL}),
  progress AS (${progressSql}) SELECT admission.readiness,progress.* FROM admission CROSS JOIN progress`;

/** Only aggregate current-run progress, never row IDs, cursors, names or error text. */
export function projectEvaluationInventoryReadiness(status, row, checkedAt) {
  const validCounts = row && countKeys.every(key => Number.isSafeInteger(row[key]) && row[key] >= 0 && row[key] <= 2147483647);
  const checkpoint = row?.latestCheckpointAt;
  if (!statuses.has(status) || !validCounts || row.notStarted + row.scanning + row.completedHandoffs !== row.completedImports ||
      !Number.isFinite(Date.parse(checkedAt)) || !(checkpoint === null || typeof checkpoint === 'string' &&
        Number.isFinite(Date.parse(checkpoint)) && Date.parse(checkpoint) <= Date.parse(checkedAt) && row.scanning > 0) ||
      status === 'ready' && row.notStarted + row.scanning + row.dueTasks + row.processingTasks > 0) {
    throw new Error('evaluation_inventory_readiness_invalid');
  }
  return { version: 'evaluation_inventory_readiness.v1', status,
    ...Object.fromEntries(countKeys.map(key => [key, row[key]])),
    latestCheckpointAt: checkpoint === null ? null : new Date(checkpoint).toISOString() };
}

/** The caller supplies the existing bounded, read-only repeatable-read transaction. */
export async function readEvaluationInventoryReadiness(client, checkedAt) {
  const { rows: [progress] } = await client.query(EVALUATION_INVENTORY_READINESS_SQL);
  return projectEvaluationInventoryReadiness(progress?.readiness, progress, checkedAt);
}
