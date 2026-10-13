/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectReviewCandidate } from './mediaIdentityReviewContract.mjs';
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';

/** Same-ID recovery only. Probe budgets are committed before external I/O. */
export function createQueueMetadataRecoveryService({ repository, readProvider, deadlineMs = 10000 }) {
  return {
    async run(callerSignal = null) {
      callerSignal?.throwIfAborted();
      const claim = await repository.claim();
      if (!claim) return { state: 'idle', queued: 0 };
      const deadline = AbortSignal.timeout(deadlineMs);
      const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
      const provider = await readProvider();
      let outcome = 'not_configured';
      let retryAfterMs = 0;
      if (provider.configured) {
        try {
          signal.throwIfAborted();
          const data = await provider.getDetails(Number(claim.tmdb_id), claim.media_type, signal);
          signal.throwIfAborted();
          projectReviewCandidate(data, Number(claim.tmdb_id), claim.media_type);
          outcome = 'available';
        } catch (error) {
          const observation = tmdbObservationFailure(error);
          retryAfterMs = observation.retryAfterMs ?? 0;
          outcome = callerSignal?.aborted ? 'cancelled' : deadline.aborted ? 'timeout'
            : error?.code === 'review_provider_invalid' ? 'invalid_response' : observation.category;
        }
      }
      if (callerSignal?.aborted) outcome = 'cancelled';
      const queued = await repository.finish(claim, outcome, async tx => {
        if (signal.aborted) return false;
        const current = await readProvider(tx);
        return !signal.aborted && current.revision === provider.revision;
      }, { signal, retryAfterMs });
      return { state: queued ? 'requeued' : outcome, queued: queued ? 1 : 0 };
    },
  };
}
