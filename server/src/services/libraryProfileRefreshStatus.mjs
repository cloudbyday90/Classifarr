/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_PROBE_DELAY_MS } from './policyNativeProfileRefreshCircuitVocabulary.mjs';
import { classifyLibraryProfileRecovery } from './libraryProfileRecoveryAssessment.mjs';

export const LIBRARY_PROFILE_REFRESH_STATUS_LIMIT = 200;
export const LIBRARY_PROFILE_REFRESH_STATUS_VERSION = 'library.profile_refresh_status.v1';

const statusIds = Object.freeze([
    'current', 'queued', 'processing', 'retry_wait', 'cooldown', 'waiting',
    'paused', 'unverified', 'no_inventory',
]);

function revision(value) {
    if (value == null) return null;
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
        throw new TypeError('Library profile status contains an invalid revision');
    }
    return value;
}

function isoDate(value) {
    if (value == null) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Library profile status contains an invalid time');
    return date.toISOString();
}

function classify(row, asOf) {
    const sourceRevision = revision(row.source_revision);
    const acknowledgedRevision = revision(row.acknowledged_revision);
    const profileRevision = revision(row.profile_revision);
    const hasInventory = row.has_inventory === true;
    const hasProfile = row.has_profile === true;
    const active = row.is_active === true;
    const dirty = sourceRevision !== null &&
        BigInt(sourceRevision) > BigInt(acknowledgedRevision ?? '0');
    const noInventory = !hasInventory && !hasProfile;
    let statusId = 'unverified';
    let retryAt = null;

    if (noInventory && !dirty) {
        statusId = 'no_inventory';
    } else if (dirty && !active) {
        statusId = 'paused';
    } else if (dirty) {
        const state = row.processing_state;
        if (state === 'processing' && isoDate(row.lease_expires_at) > asOf) {
            statusId = 'processing';
        } else if (state === 'pending') {
            const availableAt = isoDate(row.available_at);
            statusId = availableAt > asOf ? 'retry_wait' : 'queued';
            if (statusId === 'retry_wait') retryAt = availableAt;
        } else if (state === 'failed') {
            const probeAt = isoDate(row.probe_at);
            statusId = probeAt > asOf ? 'cooldown' : 'waiting';
            if (statusId === 'cooldown') retryAt = probeAt;
        } else {
            statusId = 'waiting';
        }
    } else if (hasInventory && hasProfile && sourceRevision !== null &&
        profileRevision === sourceRevision) {
        statusId = 'current';
    }

    return {
        libraryId: Number(row.library_id),
        name: String(row.name ?? '').slice(0, 160),
        isActive: active,
        statusId,
        sourceRevision,
        acknowledgedRevision,
        profileRevision,
        retryAt,
        recoveryReasonId: classifyLibraryProfileRecovery({ ...row, dirty }, asOf),
    };
}

/** A bounded, single-statement snapshot. Reads never enqueue or acknowledge work. */
export async function readLibraryProfileRefreshStatus(db) {
    const { rows } = await db.query(`WITH selected AS MATERIALIZED (
        SELECT library.id, library.name, library.is_active,
            state.revision::text AS source_revision,
            state.refreshed_revision::text AS acknowledged_revision, state.changed_at,
            (state.revision > state.refreshed_revision) AS dirty
        FROM libraries library
        LEFT JOIN library_profile_inventory_state state ON state.library_id = library.id
        ORDER BY (state.revision > state.refreshed_revision) DESC NULLS LAST, library.id
        LIMIT $2::integer
    ) SELECT library.id AS library_id, library.name, library.is_active,
        library.source_revision, library.acknowledged_revision, library.changed_at,
        profile.inventory_revision::text AS profile_revision,
        (profile.library_id IS NOT NULL) AS has_profile,
        EXISTS (SELECT 1 FROM media_server_items item WHERE item.library_id = library.id) AS has_inventory,
        latest.processing_state, latest.available_at, latest.lease_expires_at,
        latest.updated_at AS job_updated_at,
        latest.updated_at + ($1::bigint * INTERVAL '1 millisecond') AS probe_at,
        statement_timestamp() AS read_at
        FROM selected library
        LEFT JOIN library_profiles profile ON profile.library_id = library.id
        LEFT JOIN LATERAL (
            SELECT processing_state, available_at, lease_expires_at, updated_at
            FROM policy_profile_refresh_outbox
            WHERE library_id = library.id AND request_type = 'inventory_change'
            ORDER BY id DESC LIMIT 1
        ) latest ON TRUE
        ORDER BY library.dirty DESC NULLS LAST, library.id`, [POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_PROBE_DELAY_MS,
        LIBRARY_PROFILE_REFRESH_STATUS_LIMIT + 1]);

    const asOf = isoDate(rows[0]?.read_at ?? new Date());
    const libraries = rows.slice(0, LIBRARY_PROFILE_REFRESH_STATUS_LIMIT)
        .map(row => classify(row, asOf));
    const summary = Object.fromEntries(statusIds.map(id => [id, 0]));
    for (const library of libraries) summary[library.statusId] += 1;
    return {
        version: LIBRARY_PROFILE_REFRESH_STATUS_VERSION,
        asOf,
        libraryCount: libraries.length,
        windowTruncated: rows.length > LIBRARY_PROFILE_REFRESH_STATUS_LIMIT,
        summary,
        libraries,
    };
}
