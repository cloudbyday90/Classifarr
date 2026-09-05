/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildQueueExternalIdPlan, decideTmdbExternalIdMatch } from './tmdbExternalIdMatch.mjs';

/** Explicit terminal review decisions cannot be mistaken for permission to try title search. */
export async function resolveQueueTmdbExternalIdentity(payload, enrichmentData, tmdbService) {
  const plan = buildQueueExternalIdPlan(payload, enrichmentData);
  const review = (reason, method = 'external_ids') => Object.freeze({
    status: 'review_required', tmdbId: null, method, reason,
  });
  if (plan.reason) return review(plan.reason);
  const resolved = [];
  for (const request of plan.requests) {
    const method = request.source === 'tvdb_id' ? 'tvdb' : 'imdb';
    let decision;
    try {
      const response = await tmdbService.findIdentityByExternalId(request.externalId, request.source);
      decision = decideTmdbExternalIdMatch(plan.mediaType, response);
    } catch {
      return review('provider_unavailable', method);
    }
    if (decision.status === 'review_required') return review(decision.reason, method);
    if (decision.status === 'resolved') resolved.push({ ...decision, method });
  }
  if (!resolved.length) return Object.freeze({
    status: 'not_found', tmdbId: null, method: 'external_ids', reason: 'external_id_not_found',
  });
  if (new Set(resolved.map((result) => result.tmdbId)).size > 1) return review('conflicting_external_ids');
  if (resolved.length !== plan.requests.length) return review('incomplete_external_evidence');
  return Object.freeze(resolved.length === 1 ? resolved[0] : {
    status: 'resolved', tmdbId: resolved[0].tmdbId, method: 'external_ids', reason: 'external_ids_agree',
  });
}
