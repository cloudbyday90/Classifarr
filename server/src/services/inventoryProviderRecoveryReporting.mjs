/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryIdentityCheck } from './inventoryIdentityCheck.mjs';

const IDENTITY_STEPS = {
    no_external_ids: 'Open the affected movie or show in your media server and verify its match. No supported external ID was available to check.',
    invalid_source_evidence: 'Verify the affected item’s media type and external IDs in your media server. Invalid source evidence was not sent to the provider.',
    external_id_not_found: 'TMDb found no record for the known external IDs. Verify the media-server match; unchanged missing records will be rechecked automatically.',
    external_ids_disagree: 'The known external IDs point to different records. Correct the media-server match; no identity was replaced.',
    incomplete_external_evidence: 'Only some external IDs matched. Verify the media-server match before changing identity.',
    ambiguous_external_evidence: 'An external ID returned multiple candidates. Verify the media-server match; no candidate was selected.',
    invalid_provider_response: 'Identity verification returned invalid evidence. Existing identity and metadata were preserved; a scheduled recheck will try again.',
    provider_unavailable: 'The external-ID check could not complete. Existing identity was preserved; the scheduled retry will recheck the provider.',
    provider_authentication: 'Check the configured TMDb credential and permissions. The external-ID check could not authenticate.',
    provider_rate_limited: 'TMDb throttled the external-ID check. Wait for the recorded retry time; no immediate retry is needed.',
    same_identity: 'External IDs still point to the missing TMDb record. No replacement was found; scheduled rechecks will detect its return.',
    source_details_incomplete: 'Verify the affected item’s title and year in your media server. Source details are incomplete, so a candidate was not accepted.',
    candidate_mismatch: 'The external-ID candidate did not match the source title and year. Verify the media-server match; no identity was replaced.',
    candidate_for_review: 'Review the candidate TMDb ID against the affected item in your media server and correct its match if appropriate. The candidate has not been applied.',
};
const STEPS = {
    not_found: 'Verify this item’s provider match in the media server. A corrected source identity is retried automatically; no replacement is guessed.',
    authentication: 'Check the configured TMDb credential and permissions. A scheduled recheck will resume metadata capture.',
    tls: 'Check the provider connection and certificate trust. TLS verification remains enabled.',
    invalid_response: 'The response did not match the requested identity or metadata schema. Existing metadata was preserved; a scheduled recheck will try again.',
};

/** Call only after the guarded metadata/recovery write succeeds. */
export function reportInventoryProviderRecovery(logger, payload, receipt) {
    const outcome = receipt?.outcome;
    if (!outcome?.transition) return;
    const record = outcome.record;
    const check = readInventoryIdentityCheck(record.identity_check, record.tmdb_id);
    const fields = { caseId: record.case_id, itemId: payload.itemId, libraryId: payload.source_library_id,
        tmdbId: record.tmdb_id, mediaType: record.media_type, category: record.category,
        attemptCount: record.attempt_count, nextRetryAt: outcome.retryAfter,
        ...(check ? { identityCheck: check } : {}) };
    if (outcome.transition === 'resolved') logger.info('Inventory TMDb metadata recovered and backfilled', fields);
    else logger.warn('Inventory TMDb observation needs recovery', { ...fields,
        recovery: (record.category === 'not_found' && check ? IDENTITY_STEPS[check.outcome] : null) ??
            STEPS[record.category] ?? 'Existing metadata was preserved. The queue will retry automatically after the recorded cooldown.' });
}
