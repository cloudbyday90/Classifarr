/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectReviewCandidate } from './mediaIdentityReviewContract.mjs';
import { buildTmdbExternalIdRequest, decideTmdbExternalIdMatch } from './tmdbExternalIdMatch.mjs';
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';
import { planQueueIdentityEvidence } from './queueIdentityEvidenceSource.mjs';

/** Bounded reads after an original-record 404. No partial match becomes a candidate. */
export async function readQueueIdentityEvidence(task, provider, { signal, deadline, callerSignal }) {
  const plan = planQueueIdentityEvidence(task);
  const stop = (reason, observation = null) => ({ reason, candidate: null, sources: [], observation });
  if (plan.reason) return stop(plan.reason);
  try {
    let candidateId = null;
    for (const request of plan.requests) {
      signal.throwIfAborted();
      const data = await provider.findByExternalId(request.externalId, request.source, signal);
      signal.throwIfAborted();
      const match = decideTmdbExternalIdMatch(task.media_type, data);
      if (match.status !== 'resolved') return stop(match.reason);
      if (candidateId !== null && candidateId !== match.tmdbId) return stop('conflicting_external_ids');
      candidateId = match.tmdbId;
    }
    if (candidateId === Number(task.tmdb_id)) return stop('original_id_only');
    signal.throwIfAborted();
    const details = await provider.getDetails(candidateId, task.media_type, signal);
    signal.throwIfAborted();
    const candidate = projectReviewCandidate(details, candidateId, task.media_type);
    const externalIds = await provider.getExternalIds(candidateId, task.media_type, signal);
    signal.throwIfAborted();
    if (!externalIds || Array.isArray(externalIds) || externalIds.id !== candidateId) return stop('invalid_response');
    for (const request of plan.requests) {
      const reverse = buildTmdbExternalIdRequest(externalIds[request.source], request.source);
      if (!reverse || reverse.externalId !== request.externalId) return stop('reverse_id_conflict');
    }
    return { reason: 'candidate_for_review', candidate,
      sources: plan.requests.map(({ source }) => source), observation: null };
  } catch (error) {
    callerSignal?.throwIfAborted();
    const observation = deadline.aborted
      ? { category: 'timeout', httpStatus: null, transportCode: 'ETIMEDOUT' }
      : error?.code === 'review_provider_invalid'
        ? { category: 'invalid_response', httpStatus: null, transportCode: null }
        : tmdbObservationFailure(error);
    return stop('provider_unavailable', observation);
  }
}
