/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { readInventoryProviderRecovery } from './inventoryProviderRecoveryPolicy.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { CURRENT_WAKEUP, WAKEUP_CANDIDATES, RELEASE_WAKEUP_ITEMS } from './inventoryCredentialWakeupQueries.mjs';

// Same ordering as configuration writers: config table, then wakeup row, then source items.
async function withCurrent(db, fn) {
    return db.withTransaction(async client => {
        await client.query("SET LOCAL lock_timeout = '1s'");
        await client.query('LOCK TABLE tmdb_config IN SHARE MODE');
        const { rows } = await client.query(CURRENT_WAKEUP);
        const { rows: clock } = await client.query('SELECT clock_timestamp() AS now');
        return rows[0] ? fn(client, rows[0], new Date(clock[0].now).getTime()) : null;
    });
}

export function createInventoryCredentialWakeupRepository(db) {
    return {
        claim: () => withCurrent(db, async (client, state, now) => {
            if (state.verified_at || new Date(state.probe_after).getTime() > now ||
                (state.probe_lease_until && new Date(state.probe_lease_until).getTime() > now)) return null;
            const { rows } = await client.query(`SELECT 1 FROM media_server_items
                WHERE inventory_tmdb_recovery->>'status'='open'
                  AND inventory_tmdb_recovery->>'category'='authentication' LIMIT 1`);
            if (!rows.length) return null;
            const token = randomUUID();
            await client.query(`UPDATE inventory_credential_wakeups SET probe_lease_id=$2,
                probe_lease_until=clock_timestamp()+interval '1 minute' WHERE config_id=$1`, [state.config_id, token]);
            return { ...state, token };
        }),
        finish: (claim, outcome, delayMs) => withCurrent(db, async (client, state, now) => {
            if (state.config_id !== claim.config_id || state.generation !== claim.generation ||
                state.probe_lease_id !== claim.token || new Date(state.probe_lease_until).getTime() <= now) return false;
            await client.query(`UPDATE inventory_credential_wakeups SET
                verified_at=CASE WHEN $2 THEN clock_timestamp() ELSE NULL END,
                probe_after=clock_timestamp()+($3::double precision * interval '1 millisecond'),
                provider_retry_after=CASE WHEN $5::double precision>0
                    THEN GREATEST(provider_retry_after,clock_timestamp()+($5::double precision * interval '1 millisecond'))
                    ELSE provider_retry_after END,
                probe_lease_id=NULL,probe_lease_until=NULL,
                probe_failures=CASE WHEN $2 THEN 0 ELSE LEAST(probe_failures+1,1000000) END,
                last_failure_category=$4 WHERE config_id=$1`,
            [state.config_id, outcome.verified, delayMs, outcome.verified ? null : outcome.category,
                !outcome.verified && Number.isFinite(outcome.retryAfterMs) ? Math.max(0, Math.min(30 * 86400000, outcome.retryAfterMs)) : 0]);
            return true;
        }),
        release: () => withCurrent(db, async (client, state, now) => {
            if (!state.verified_at || new Date(state.batch_after).getTime() > now) return { released: 0 };
            const { rows } = await client.query(WAKEUP_CANDIDATES, [state.after_item_id, state.generation,
                state.verified_at, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
            const ids = rows.filter(row => {
                const record = readInventoryProviderRecovery(row.recovery, row.tmdb_id, row.media_type);
                return record?.status === 'open' && record.category === 'authentication' &&
                    Date.parse(record.last_seen) <= new Date(state.verified_at).getTime();
            }).map(row => row.id);
            if (ids.length) await client.query(RELEASE_WAKEUP_ITEMS, [ids, state.generation]);
            await client.query(`UPDATE inventory_credential_wakeups SET after_item_id=$2,
                batch_after=clock_timestamp()+interval '1 minute', released_count=released_count+$3,
                last_released_at=CASE WHEN $3>0 THEN clock_timestamp() ELSE last_released_at END WHERE config_id=$1`,
            [state.config_id, rows.length === 100 ? rows.at(-1).id : 0, ids.length]);
            return { released: ids.length };
        }),
    };
}
