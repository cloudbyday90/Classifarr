/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildTmdbExternalIdPlan } from './tmdbExternalIdMatch.mjs';
import { resolveTmdbExternalIdentity } from './tmdbExternalIdentityResolution.mjs';
import { buildTmdbTitleRequest, decideTmdbTitleMatch } from './tmdbTitleMatch.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';

const RESOLUTION_OUTCOMES = {
    external_id_not_found: 'external_id_not_found',
    conflicting_external_ids: 'external_ids_disagree',
    incomplete_external_evidence: 'incomplete_external_evidence',
    ambiguous_external_id: 'ambiguous_external_evidence',
};

/** Only invoke after a leased 404. Source is the captured database row, not queued hints. */
export async function revalidateInventoryIdentity(source, currentTmdbId, provider, now = Date.now) {
    const finish = (outcome, candidate = null, retryAfterMs = 0) => ({
        check: { version: 1, outcome, checked_at: new Date(now()).toISOString(), candidate_tmdb_id: candidate },
        retryAfterMs,
    });
    const unavailable = error => {
        const failure = tmdbObservationFailure(error);
        const outcome = failure.category === 'authentication' ? 'provider_authentication'
            : failure.category === 'rate_limited' ? 'provider_rate_limited' : 'provider_unavailable';
        return finish(outcome, null, failure.retryAfterMs ?? 0);
    };
    const plan = buildTmdbExternalIdPlan(source, {});
    if (!positiveDatabaseInteger(currentTmdbId) || plan.reason) return finish('invalid_source_evidence');
    if (!plan.requests.length) return finish('no_external_ids');
    // Capture sanitized timing while retaining the shared resolver's exact-match contract.
    let lookupFailure;
    const resolution = await resolveTmdbExternalIdentity(source, {}, {
        async findIdentityByExternalId(id, type) {
            try { return await provider.findIdentityByExternalId(id, type); }
            catch (error) { lookupFailure = unavailable(error); throw error; }
        },
    });
    if (lookupFailure) return lookupFailure;
    if (resolution.status !== 'resolved') {
        return finish(RESOLUTION_OUTCOMES[resolution.reason] ?? 'invalid_provider_response');
    }
    if (resolution.tmdbId === currentTmdbId) return finish('same_identity');
    const request = buildTmdbTitleRequest(source.title, plan.mediaType, source.year);
    if (!request) return finish('source_details_incomplete');
    let details;
    try { details = await provider.getIdentityDetails(resolution.tmdbId, plan.mediaType); }
    catch (error) { return unavailable(error); }
    if (positiveDatabaseInteger(details?.id) !== resolution.tmdbId) return finish('invalid_provider_response');
    const match = decideTmdbTitleMatch(request,
        { page: 1, total_pages: 1, total_results: 1, results: [details] });
    if (match.tmdbId !== resolution.tmdbId) return finish(match.reason === 'invalid_response'
        ? 'invalid_provider_response' : 'candidate_mismatch');
    return finish('candidate_for_review', resolution.tmdbId);
}
