/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
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
    const fields = { caseId: record.case_id, itemId: payload.itemId, libraryId: payload.source_library_id,
        tmdbId: record.tmdb_id, mediaType: record.media_type, category: record.category,
        attemptCount: record.attempt_count, nextRetryAt: outcome.retryAfter };
    if (outcome.transition === 'resolved') logger.info('Inventory TMDb metadata recovered and backfilled', fields);
    else logger.warn('Inventory TMDb observation needs recovery', { ...fields,
        recovery: STEPS[record.category] ?? 'Existing metadata was preserved. The queue will retry automatically after the recorded cooldown.' });
}
