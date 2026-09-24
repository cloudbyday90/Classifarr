/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { recordClassificationCorrection } from './classificationCorrectionWriter.mjs';
import { classificationMoveRevision, moveBlocked } from './reclassificationMoveContract.mjs';

export function createReclassificationMoveRepository(db) {
  return {
    async find(classificationId) {
      const { rows } = await db.query(`SELECT * FROM reclassification_move_operations
        WHERE classification_id = $1 ORDER BY (state <> 'completed') DESC, created_at DESC, id DESC LIMIT 1`, [classificationId]);
      return rows[0] ?? null;
    },
    async classification(id) {
      return (await db.query('SELECT * FROM classification_history WHERE id = $1', [id])).rows[0] ?? null;
    },
    async reserve(classificationId, targetLibraryId, correctedBy, plan) {
      const key = `${plan.mediaType}:${plan.configId}:${plan.remoteId}`;
      const { rows } = await db.query(`INSERT INTO reclassification_move_operations
        (id, classification_id, target_library_id, corrected_by, resource_key, plan)
        SELECT $1, $2, $3, $4, $5, $6::jsonb
        WHERE (SELECT count(*) FROM reclassification_move_operations WHERE state <> 'completed') < 1000
          AND NOT EXISTS (
            SELECT 1 FROM reclassification_move_operations active,
              LATERAL (VALUES (translate(active.plan->>'localOldPath', chr(92), '/')),
                (translate(active.plan->>'localNewPath', chr(92), '/'))) occupied(path),
              (VALUES ($7::text), ($8::text)) requested(path)
            WHERE active.state <> 'completed' AND (
              lower(occupied.path) = lower(requested.path)
              OR starts_with(lower(occupied.path), lower(requested.path) || '/')
              OR starts_with(lower(requested.path), lower(occupied.path) || '/')
            )
          )
        ON CONFLICT DO NOTHING RETURNING *`, [randomUUID(), classificationId, targetLibraryId, correctedBy, key,
        JSON.stringify(plan), plan.localOldPath.replaceAll('\\', '/'), plan.localNewPath.replaceAll('\\', '/')]);
      if (!rows[0]) throw moveBlocked('move_reserved', 'An unresolved move already owns this item, or the recovery limit has been reached. Resolve existing move reports before starting another move.');
      return rows[0];
    },
    async attempted(id) {
      await db.query(`UPDATE reclassification_move_operations SET attempts = LEAST(attempts + 1, 31),
        updated_at = NOW(), next_attempt_at = NOW() + INTERVAL '1 hour' WHERE id = $1 AND state <> 'completed'`, [id]);
    },
    async defer(operation, reason, blocked) {
      const { rows } = await db.query(`UPDATE reclassification_move_operations
        SET state = CASE WHEN $3 THEN 'needs_attention' ELSE state END, reason_code = $2,
          next_attempt_at = NOW() + make_interval(secs => LEAST(3600, 30 * power(2, LEAST(attempts, 7)))::integer), updated_at = NOW()
        WHERE id = $1 AND state <> 'completed' RETURNING *`, [operation.id, reason, blocked]);
      return rows[0] ?? null;
    },
    async complete(operation) {
      return db.withTransaction(async client => {
        const locked = (await client.query('SELECT * FROM reclassification_move_operations WHERE id = $1 FOR UPDATE', [operation.id])).rows[0];
        if (!locked) throw moveBlocked('move_journal_missing', 'Move recovery evidence is missing; inspect the database before retrying.');
        if (locked.state === 'completed') return;
        const classification = (await client.query('SELECT * FROM classification_history WHERE id = $1 FOR UPDATE', [operation.classification_id])).rows[0];
        if (!classification || classificationMoveRevision(classification) !== operation.plan.classificationRevision) {
          throw moveBlocked('move_classification_changed', 'Classification changed or was removed during the move. Inspect history and actual placement before applying another correction.');
        }
        const destination = await client.query('SELECT id FROM libraries WHERE id = $1 AND is_active IS TRUE AND media_type = $2 FOR SHARE',
          [operation.target_library_id, operation.plan.mediaType]);
        if (!destination.rows[0]) throw moveBlocked('move_library_changed', 'The destination library changed or became inactive. Restore it before retrying.');
        await client.query(`UPDATE classification_history SET library_id = $1,
          library_name = (SELECT name FROM libraries WHERE id = $1), status = 'reclassified' WHERE id = $2`,
        [operation.target_library_id, operation.classification_id]);
        await recordClassificationCorrection(client, { classification, originalLibraryId: operation.plan.originalLibraryId,
          destinationLibraryId: operation.target_library_id, correctedBy: operation.corrected_by });
        await client.query(`UPDATE reclassification_move_operations SET state = 'completed', reason_code = NULL,
          completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [operation.id]);
      });
    },
    async due() {
      return (await db.query(`SELECT * FROM reclassification_move_operations
        WHERE state IN ('moving', 'files_verified') AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at, id LIMIT 1`)).rows[0] ?? null;
    },
    async prune() {
      await db.query(`DELETE FROM reclassification_move_operations WHERE id IN (
        SELECT id FROM reclassification_move_operations WHERE state = 'completed'
          AND completed_at < NOW() - INTERVAL '30 days' ORDER BY completed_at LIMIT 100)`);
    },
    async verified(id) {
      await db.query(`UPDATE reclassification_move_operations SET state = 'files_verified', updated_at = NOW()
        WHERE id = $1 AND state <> 'completed'`, [id]);
    },
  };
}
