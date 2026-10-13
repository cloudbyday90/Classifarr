/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { assertRepairRequest } from './queueIdentityRepairPayload.mjs';

export function repairTaskId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d{0,15}$/.test(String(value)) ||
      !Number.isSafeInteger(Number(value))) throw new ValidationError('Invalid task ID');
  return String(value);
}

export function repairConflict() {
  return new ConflictError('This task or its evidence changed, is incomplete, or has other work recorded. Review it again.',
    { code: 'queue_identity_repair_conflict' });
}

export function repairSourceVersion(task) {
  return createHash('sha256').update(JSON.stringify([
    String(task.id), task.revision, task.source_id, task.source_revision,
  ])).digest('hex');
}

export function assertRepairPayload(task, repaired = false) {
  assertRepairRequest(task.payload, repaired);
  if (!['webhook', 'manual'].includes(task.source)) {
    throw new ConflictError('This request format needs a separately reviewed repair.', { code: 'queue_identity_repair_unsupported' });
  }
  if (!Number.isInteger(task.attempts) || task.attempts < 1 ||
      !Number.isInteger(task.max_attempts) || task.max_attempts > 5 || task.attempts >= task.max_attempts ||
      task.classification_recovery_attempts !== 0) {
    throw new ConflictError('The remaining retry budget does not permit this repair.', { code: 'queue_identity_repair_budget' });
  }
}

export function projectRepairReceipt(row) {
  if (!row) return null;
  return { id: row.id, taskId: String(row.task_id), actorId: row.actor_id,
    oldTmdbId: row.old_tmdb_id, newTmdbId: row.new_tmdb_id, mediaType: row.media_type,
    candidate: row.candidate, sources: row.sources, confirmedAt: row.confirmed_at,
    retriedAt: row.retried_at, attempts: row.attempts, maxAttempts: row.max_attempts };
}
