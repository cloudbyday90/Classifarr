/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { boundOmdbAdmissionTransaction, omdbPacingWait } from './omdbPacingStore.mjs';
import { readOmdbQuota } from './omdbQuotaStore.mjs';

/** Read-only eligibility check; neither reserves credit nor extends evidence age. */
export async function readRecentOmdbLookup(db, recent, context, { allowNotFound = false } = {}) {
    const candidate = recent.read(context);
    if (!candidate || (candidate.kind !== 'success' && !allowNotFound)) return null;
    const eligible = await db.withTransaction(async client => {
        await boundOmdbAdmissionTransaction(client);
        // Keep context, budget and pacing reads consistent with concurrent saves.
        await client.query('LOCK TABLE omdb_config IN SHARE MODE');
        const { rows: [current] } = await client.query(`SELECT id, credential_generation, credential_rejected_at
            FROM omdb_config WHERE is_active = true ORDER BY id DESC LIMIT 1`);
        if (current?.id !== context.id || current?.credential_generation !== context.generation ||
            current?.credential_rejected_at) return false;
        if ((await readOmdbQuota(client)).status !== 'available') return false;
        return await omdbPacingWait(client, context) === 0;
    });
    return eligible && recent.read(context) === candidate ? candidate : null;
}
