/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError, ValidationError } from '../utils/appError.mjs';
import { projectReviewCandidate, reviewInteger } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';

const FAILURES = new Set(['task_metadata_not_found', 'task_metadata_fetch_failed', 'task_processing_failed']);

async function readTask(db, id) {
  const { rows } = await db.query(`SELECT id, xmin::text AS revision, task_type, status,
    current_stage, error_message, claim_token, routing_classification_id,
    payload->>'tmdb_id' AS tmdb_id, payload->>'media_type' AS media_type
    FROM task_queue WHERE id = $1`, [id]);
  const task = rows[0];
  if (!task) throw new NotFoundError('Task no longer exists');
  if (task.task_type !== 'classification' || task.status !== 'failed' ||
      task.current_stage !== 'metadata_fetch' || !FAILURES.has(task.error_message) ||
      task.claim_token !== null || task.routing_classification_id !== null ||
      !['movie', 'tv'].includes(task.media_type)) {
    throw new ConflictError('This task is no longer eligible for a metadata check');
  }
  reviewInteger(task.tmdb_id);
  return task;
}

export function createQueueMetadataCheckService({ db, readProvider, now = () => new Date(), deadlineMs = 10000 }) {
  let busy = false;
  return {
    async check(actorId, rawTaskId, body, callerSignal = null) {
      const taskId = String(rawTaskId);
      if (!/^[1-9]\d{0,15}$/.test(taskId) || !Number.isSafeInteger(Number(taskId))) {
        throw new ValidationError('Invalid task ID');
      }
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length !== 0) {
        throw new ValidationError('Metadata checks do not accept replacement identities');
      }
      await requireReviewActor(db, actorId);
      if (busy) throw new ConflictError('Another metadata check is running. Try again shortly.');
      busy = true;
      try {
        callerSignal?.throwIfAborted();
        const task = await readTask(db, taskId);
        const provider = await readProvider();
        const deadline = AbortSignal.timeout(deadlineMs);
        const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
        let observation = { category: 'not_configured', httpStatus: null, transportCode: null };
        let candidate = null;
        if (provider.configured) {
          try {
            signal.throwIfAborted();
            const data = await provider.getDetails(Number(task.tmdb_id), task.media_type, signal);
            signal.throwIfAborted();
            candidate = projectReviewCandidate(data, Number(task.tmdb_id), task.media_type);
            observation = { category: 'available', httpStatus: 200, transportCode: null };
          } catch (error) {
            callerSignal?.throwIfAborted();
            observation = deadline.aborted
              ? { category: 'timeout', httpStatus: null, transportCode: 'ETIMEDOUT' }
              : error?.code === 'review_provider_invalid'
                ? { category: 'invalid_response', httpStatus: null, transportCode: null }
                : tmdbObservationFailure(error);
          }
        }
        callerSignal?.throwIfAborted();
        // No provider result is current authority if the task, settings or actor changed.
        await requireReviewActor(db, actorId);
        const current = await readTask(db, taskId);
        const currentProvider = await readProvider();
        if (current.revision !== task.revision || currentProvider.revision !== provider.revision) {
          throw new ConflictError('The task or TMDb settings changed. Check the record again.');
        }
        callerSignal?.throwIfAborted();
        return {
          taskId, tmdbId: Number(task.tmdb_id), mediaType: task.media_type,
          savedFailure: task.error_message, checkedAt: now().toISOString(), observation, candidate,
        };
      } finally { busy = false; }
    },
  };
}
