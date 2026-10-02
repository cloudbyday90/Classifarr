/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { QueueConcurrencySettingsService } from '../services/queueConcurrencySettingsService.mjs';
import { readBacklogTasks } from './installationBacklogEvidence.mjs';
import { BACKLOG_GATE_APPLICATION } from './installationBacklogFixture.mjs';

export async function readParkedBacklogWorkers(db) {
  const result = await db.query(`SELECT count(*)::integer AS count FROM pg_stat_activity
    WHERE datname=current_database() AND application_name=$1 AND state='active'
      AND wait_event_type='Timeout' AND wait_event='PgSleep'`, [BACKLOG_GATE_APPLICATION]);
  return result.rows[0].count;
}

/** Use the real configured worker bound; never change concurrency to make a test pass. */
export async function readBacklogWorkerLimit(db) {
  const { rows } = await db.query("SELECT key,value FROM settings WHERE key='queue_metadata_enrichment_workers'");
  return new QueueConcurrencySettingsService().normalizeRows(rows).metadataEnrichmentWorkers;
}

/** Every metadata slot must be parked before a durable, exact claim snapshot. */
export async function backlogBoundarySettled(db, ids, workerLimit) {
  const tasks = await readBacklogTasks(db, ids);
  if (tasks.length !== 600 || tasks.filter(row => row.status === 'processing').length !== workerLimit ||
    tasks.some(row => !['pending', 'processing'].includes(row.status))) return false;
  const handoffs = await db.query(`SELECT count(*)::integer AS count FROM library_ingestion_state
    WHERE library_id=ANY($1::integer[]) AND backfill_completed_at IS NOT NULL AND backfill_run_id=run_id`, [ids]);
  if (handoffs.rows[0].count !== 2) return false;
  return await readParkedBacklogWorkers(db) === workerLimit;
}
