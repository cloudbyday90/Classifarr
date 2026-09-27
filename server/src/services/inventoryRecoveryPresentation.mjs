/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryProviderRecovery } from './inventoryProviderRecoveryPolicy.mjs';
import { inventoryProviderRecoveryInstruction } from './inventoryProviderRecoveryReporting.mjs';

const LABELS = {
    not_found: 'TMDb record not found', authentication: 'TMDb access rejected',
    rate_limited: 'TMDb is limiting requests', upstream_error: 'TMDb temporarily unavailable',
    request_rejected: 'TMDb rejected the request', timeout: 'TMDb request timed out',
    cancelled: 'Request interrupted', response_too_large: 'Response exceeded the safety limit',
    tls: 'Secure connection failed', network: 'Provider connection failed',
    unknown: 'Provider check could not complete', invalid_response: 'Unexpected provider metadata',
};
const text = value => typeof value === 'string' ? value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim().slice(0, 500) : '';
const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

export function projectInventoryRecovery(row, asOf) {
    const record = readInventoryProviderRecovery(row.recovery, row.tmdb_id, row.media_type);
    const blocked = row.source_blocked === true;
    const retryAt = timestamp(row.retry_after);
    const leaseUntil = timestamp(row.lease_until);
    const sourceReview = blocked || (record?.category === 'not_found' &&
        !['provider_unavailable', 'provider_authentication', 'provider_rate_limited', 'invalid_provider_response', 'same_identity']
            .includes(record.identity_check?.outcome));
    const retryState = blocked ? 'source_blocked' : leaseUntil && leaseUntil > asOf ? 'in_progress'
        : !retryAt ? 'not_scheduled' : retryAt > asOf ? 'waiting' : 'eligible';
    return {
        id: row.id, caseId: record?.case_id ?? null, title: text(row.title) || 'Untitled item',
        libraryName: text(row.library_name) || 'Unknown library',
        year: Number.isInteger(row.year) && row.year > 0 && row.year <= 9999 ? row.year : null,
        mediaType: row.media_type, tmdbId: row.tmdb_id, isPlex: row.server_type === 'plex',
        diagnosis: blocked ? 'Source identity conflict blocks recovery'
            : record ? LABELS[record.category] : 'Recovery details unavailable',
        instruction: blocked ? 'Correct the item’s match in the media server. A later library sync must clear the source conflict before provider recovery can continue.'
            : record ? inventoryProviderRecoveryInstruction(record) : 'The saved case could not be interpreted. Refresh later; no identity change is authorized.',
        sourceReview, retryState, retryAt, attemptCount: record?.attempt_count ?? null,
        lastCheckedAt: record?.last_seen ?? null, identityCheck: record?.identity_check ?? null,
    };
}
