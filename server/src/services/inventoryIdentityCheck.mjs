/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

const OUTCOMES = new Set(['no_external_ids', 'invalid_source_evidence', 'external_id_not_found',
    'external_ids_disagree', 'incomplete_external_evidence', 'ambiguous_external_evidence',
    'invalid_provider_response', 'provider_unavailable', 'provider_authentication', 'provider_rate_limited',
    'same_identity', 'source_details_incomplete', 'candidate_mismatch', 'candidate_for_review']);

/** Optional, backward-compatible evidence. It conveys no identity-write authority. */
export function readInventoryIdentityCheck(value, currentTmdbId) {
    if (value?.version !== 1 || !OUTCOMES.has(value.outcome) ||
        typeof value.checked_at !== 'string' || value.checked_at.length > 32 ||
        !Number.isFinite(Date.parse(value.checked_at))) return null;
    const candidate = positiveDatabaseInteger(value.candidate_tmdb_id);
    if (value.outcome === 'candidate_for_review'
        ? !candidate || candidate === currentTmdbId
        : value.candidate_tmdb_id != null) return null;
    return { version: 1, outcome: value.outcome, checked_at: value.checked_at,
        candidate_tmdb_id: value.outcome === 'candidate_for_review' ? candidate : null };
}
