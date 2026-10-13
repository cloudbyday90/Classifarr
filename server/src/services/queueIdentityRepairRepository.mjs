/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readQueueMetadataCheckTask } from './queueMetadataCheckRepository.mjs';
import { ConflictError } from '../utils/appError.mjs';
import { assertRepairPayload, repairConflict, repairSourceVersion } from './queueIdentityRepairContract.mjs';
import { REQUEST_IDENTITY_WHITESPACE_SQL as WHITESPACE } from './requestIdentitySqlWhitespace.mjs';

/** Rare administrative final gate. No provider I/O while these locks are held. */
export async function lockRepairWrites(tx) {
  await tx.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
  await tx.query("SET LOCAL lock_timeout = '1s'");
  await tx.query("SET LOCAL statement_timeout = '3s'");
  await tx.query("SET LOCAL transaction_timeout = '5s'");
  await tx.query(`LOCK TABLE task_queue, classification_history, classification_intake_receipts,
    classification_queue_decision_witnesses, webhook_log, tmdb_config IN SHARE ROW EXCLUSIVE MODE`);
}

export async function readRepairReceipt(db, taskId) {
  return (await db.query('SELECT * FROM queue_identity_repair_receipts WHERE task_id=$1', [taskId])).rows[0] || null;
}

export async function readRepairTask(db, taskId, repaired = false) {
  const identity = await readQueueMetadataCheckTask(db, taskId);
  const { rows } = await db.query(`SELECT payload, source, attempts, max_attempts,
    classification_recovery_attempts, xmin::text AS revision FROM task_queue WHERE id=$1`, [taskId]);
  if (!rows[0] || rows[0].revision !== identity.revision) throw repairConflict();
  const task = { ...identity, ...rows[0] };
  assertRepairPayload(task, repaired);
  return task;
}

export async function requireNoRepairEffects(db, taskId, mediaType, oldId, newId) {
  const { rows } = await db.query(`SELECT
    EXISTS (SELECT 1 FROM classification_intake_receipts WHERE queue_task_id=$1 AND
      (classification_id IS NOT NULL OR decision_context IS NOT NULL)) OR
    EXISTS (SELECT 1 FROM classification_queue_decision_witnesses WHERE queue_task_id=$1) OR
    EXISTS (SELECT 1 FROM classification_history WHERE media_type=$2 AND tmdb_id IN ($3,$4)) OR
    EXISTS (SELECT 1 FROM task_queue WHERE id<>$1 AND task_type='classification'
      AND status IS DISTINCT FROM 'cancelled'
      AND $2 IN (lower(btrim(payload->>'media_type',${WHITESPACE}) COLLATE "C"),lower(btrim(payload->>'mediaType',${WHITESPACE}) COLLATE "C"),
        lower(btrim(payload#>>'{media,media_type}',${WHITESPACE}) COLLATE "C"),lower(btrim(payload#>>'{media,mediaType}',${WHITESPACE}) COLLATE "C"))
      AND EXISTS (SELECT 1 FROM (
        SELECT value FROM (VALUES (payload->>'tmdb_id'),(payload->>'tmdbId'),(payload#>>'{media,tmdbId}'),
          (payload#>>'{media,tmdb_id}')) AS declared(value)
        UNION ALL
        SELECT entry->>'value' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(payload->'extra')='array'
          THEN payload->'extra' ELSE '[]'::jsonb END) AS entry
          WHERE lower(entry->>'name') LIKE '%tmdb%'
      ) AS ids WHERE regexp_replace(btrim(value,${WHITESPACE}),'^0+','') IN ($3::text,$4::text))) AS blocked`, [taskId, mediaType, oldId, newId]);
  if (rows[0].blocked) throw new ConflictError('Other work or a prior decision is recorded for this request.', { code: 'queue_identity_repair_prior_work' });
}

export async function storeRepairPreview(db, data) {
  const { actorId, id, taskId, version, providerRevision, candidate, sources } = data;
  const { rows } = await db.query(`INSERT INTO queue_identity_repair_previews
    (actor_id,id,task_id,source_version,provider_revision,candidate,sources,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,clock_timestamp()+interval '10 minutes')
    ON CONFLICT (actor_id) DO UPDATE SET id=EXCLUDED.id,task_id=EXCLUDED.task_id,
      source_version=EXCLUDED.source_version,provider_revision=EXCLUDED.provider_revision,
      candidate=EXCLUDED.candidate,sources=EXCLUDED.sources,expires_at=EXCLUDED.expires_at
    RETURNING expires_at`, [actorId, id, taskId, version, providerRevision, JSON.stringify(candidate), JSON.stringify(sources)]);
  return rows[0].expires_at;
}

export async function readRepairPreview(db, actorId, taskId, id) {
  const { rows } = await db.query(`SELECT * FROM queue_identity_repair_previews
    WHERE actor_id=$1 AND task_id=$2 AND id=$3 AND expires_at>clock_timestamp()`, [actorId, taskId, id]);
  if (!rows[0]) throw repairConflict();
  return rows[0];
}

export async function persistRepair(tx, actorId, task, preview) {
  const { rows } = await tx.query(`UPDATE task_queue SET payload=jsonb_set(payload,'{tmdb_id}',$2::jsonb)
    || jsonb_build_object('identity_repair',$3::text) WHERE id=$1 RETURNING xmin::text AS revision`,
  [task.id, JSON.stringify(preview.candidate.tmdbId), preview.id]);
  await tx.query(`INSERT INTO queue_identity_repair_receipts
    (task_id,id,actor_id,source_id,source_version,provider_revision,old_tmdb_id,new_tmdb_id,
      media_type,candidate,sources,attempts,max_attempts,repaired_version)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14)`,
  [task.id, preview.id, actorId, task.source_id, preview.source_version, preview.provider_revision,
    Number(task.tmdb_id), preview.candidate.tmdbId, task.media_type, JSON.stringify(preview.candidate),
    JSON.stringify(preview.sources), task.attempts, task.max_attempts,
    repairSourceVersion({ ...task, revision: rows[0].revision })]);
  await tx.query('DELETE FROM queue_identity_repair_previews WHERE actor_id=$1 AND id=$2', [actorId, preview.id]);
  return readRepairReceipt(tx, task.id);
}
