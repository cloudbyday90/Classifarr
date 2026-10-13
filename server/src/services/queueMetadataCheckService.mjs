/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { projectReviewCandidate } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';
import { readQueueMetadataCheckTask } from './queueMetadataCheckRepository.mjs';
import { readQueueIdentityEvidence } from './queueIdentityEvidenceService.mjs';

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
        const task = await readQueueMetadataCheckTask(db, taskId);
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
        const identityEvidence = observation.category === 'not_found'
          ? await readQueueIdentityEvidence(task, provider, { signal, deadline, callerSignal }) : null;
        callerSignal?.throwIfAborted();
        // No provider result is current authority if the task, settings or actor changed.
        await requireReviewActor(db, actorId);
        const current = await readQueueMetadataCheckTask(db, taskId);
        const currentProvider = await readProvider();
        if (current.revision !== task.revision || current.source_revision !== task.source_revision ||
            current.source_id !== task.source_id || currentProvider.revision !== provider.revision) {
          throw new ConflictError('The task, saved source or TMDb settings changed. Check the record again.');
        }
        callerSignal?.throwIfAborted();
        return {
          taskId, tmdbId: Number(task.tmdb_id), mediaType: task.media_type,
          savedFailure: task.error_message, checkedAt: now().toISOString(), observation, candidate, identityEvidence,
        };
      } finally { busy = false; }
    },
  };
}
