/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Buffer } from 'node:buffer';
import { requireScopedRepairId, SCOPED_REPAIR_LIMITS as limits } from './contract.mjs';
import { withScopedRepairLibraries } from './locking.mjs';

const fields = new Set(['kind', 'id', 'expectedLibraryId', 'libraryId', 'mediaType', 'tmdbId', 'metadata', 'attemptedAt', 'fetchedAt']);
const optionalId = id => id === null ? null : requireScopedRepairId(id);
function timestamp(value) {
    if (value == null) return null;
    if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid scoped repair timestamp');
    return new Date(value).toISOString();
}

export function normalizeScopedMutations(input) {
    if (!Array.isArray(input) || input.length < 1 || input.length > limits.mutations) throw new Error('Invalid scoped repair mutation batch');
    const seen = new Set();
    return input.map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !fields.has(key)) ||
            !['insert', 'replace', 'delete'].includes(item.kind)) throw new Error('Invalid scoped repair mutation');
        const id = requireScopedRepairId(item.id);
        if (seen.has(id)) throw new Error('Duplicate scoped repair item');
        seen.add(id);
        const expectedLibraryId = item.kind === 'insert' ? null : optionalId(item.expectedLibraryId);
        const libraryId = item.kind === 'delete' ? null : optionalId(item.libraryId);
        const mediaType = item.mediaType ?? null, tmdbId = optionalId(item.tmdbId ?? null);
        if (mediaType !== null && (typeof mediaType !== 'string' || mediaType.length > 32)) throw new Error('Invalid scoped repair media type');
        const metadata = JSON.stringify(item.metadata ?? {});
        if (metadata === undefined || Buffer.byteLength(metadata) > limits.metadataBytes) throw new Error('Invalid scoped repair metadata size');
        return { kind: item.kind, id, expectedLibraryId, libraryId, mediaType, tmdbId, metadata,
            attemptedAt: timestamp(item.attemptedAt), fetchedAt: timestamp(item.fetchedAt) };
    }).sort((a, b) => a.id - b.id);
}

/** Full-row replacement; a stale membership assertion rolls back the whole batch. */
export async function mutateScopedRepair(db, scope, input) {
    const mutations = normalizeScopedMutations(input);
    const ids = mutations.flatMap(item => [item.expectedLibraryId, item.libraryId]);
    return withScopedRepairLibraries(db, scope, ids, 'write', async ns => {
        for (const item of mutations) {
            let result;
            if (item.kind === 'delete') {
                result = await db.query(`DELETE FROM ${ns}.scoped_repair_source WHERE id=$1 AND library_id IS NOT DISTINCT FROM $2::integer`, [item.id, item.expectedLibraryId]);
            } else {
                const values = [item.id, item.libraryId, item.mediaType, item.tmdbId, item.metadata, item.attemptedAt, item.fetchedAt];
                result = item.kind === 'insert' ? await db.query(`INSERT INTO ${ns}.scoped_repair_source(id,library_id,media_type,tmdb_id,metadata,
                    inventory_tmdb_attempted_at,inventory_tmdb_fetched_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, values) :
                    await db.query(`UPDATE ${ns}.scoped_repair_source SET library_id=$2,media_type=$3,tmdb_id=$4,metadata=$5,
                        inventory_tmdb_attempted_at=$6,inventory_tmdb_fetched_at=$7 WHERE id=$1 AND library_id IS NOT DISTINCT FROM $8::integer`, [...values, item.expectedLibraryId]);
            }
            if (result.rowCount !== 1) throw new Error('Scoped repair membership changed or item missing');
        }
        return { applied: mutations.length };
    });
}
