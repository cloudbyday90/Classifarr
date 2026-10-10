/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { episodeGapRequests, inspectEpisodeExternalIdResponse, compareEpisodeReferences,
  EpisodeExternalIdEvidenceError } from './episodeExternalIdEvidence.mjs';

export const EPISODE_REFERENCE_LIMITS = Object.freeze({ lookupsPerItem: 64, lookupsPerRun: 128 });

/** No persistent cache, repairs or retries. Caller must recheck source and selection. */
export async function inspectEpisodeGapReferences(source, catalog, tmdb, { signal, budget }) {
  try {
    signal.throwIfAborted();
    const plans = episodeGapRequests(source.episodes, catalog);
    const candidates = [...source.identity.providerIds.tmdb_id];
    const requested = plans.reduce((sum, plan) => sum + plan.requests.length, 0);
    if (requested > EPISODE_REFERENCE_LIMITS.lookupsPerItem || !Number.isSafeInteger(budget.remainingLookups) ||
        requested > budget.remainingLookups) return { outcome: 'episode_reference_limit' };
    const gapComparisons = {};
    let gapLookups = 0;
    for (const plan of plans) {
      signal.throwIfAborted();
      const findings = [];
      for (const { field, id } of plan.requests) {
        signal.throwIfAborted();
        budget.remainingLookups--; gapLookups++;
        const response = await tmdb.findIdentityByExternalId(id, field, { signal });
        signal.throwIfAborted();
        findings.push(inspectEpisodeExternalIdResponse(response));
      }
      const code = plan.outcome ?? compareEpisodeReferences(plan.item, findings, catalog, candidates);
      gapComparisons[code] = (gapComparisons[code] ?? 0) + 1;
    }
    return { gapComparisons, gapLookups };
  } catch (error) {
    signal.throwIfAborted();
    return { outcome: error instanceof EpisodeExternalIdEvidenceError ? 'episode_references_invalid' : 'episode_references_unavailable' };
  }
}
