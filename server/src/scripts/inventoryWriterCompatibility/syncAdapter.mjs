/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { READ_SYNC_ITEM, UPSERT_SYNC_ITEM } from '../../services/mediaSyncItemQueries.mjs';
import { requireScopedRepairId } from '../libraryScopedRepair/contract.mjs';
import { lockScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';
import { scopedSyncQueries } from './syncQueries.mjs';

export const SYNC_IDENTITY_LOCK_NAMESPACE = 0x434c5349;
function validateKey(values) {
    requireScopedRepairId(values[0]);
    if (typeof values[1] !== 'string' || !values[1].trim() || [...values[1]].length > 100 || values[1].includes('\0')) throw new Error('Invalid sync identity key');
    return createHash('sha256').update(JSON.stringify(values)).digest().readInt32BE(0);
}
function validateWrite(values) {
    if (!Array.isArray(values) || values.length !== 19) throw new Error('Invalid sync write contract');
    if (values[1] !== null) requireScopedRepairId(values[1]);
    if ((values[17] !== null && (typeof values[17] !== 'string' || !/^\d{1,10}$/.test(values[17]))) ||
        typeof values[18] !== 'boolean') throw new Error('Invalid sync revision contract');
    if (typeof values[16] !== 'string' || Buffer.byteLength(JSON.stringify(values)) > 65536) throw new Error('Sync payload exceeds bound');
    JSON.parse(values[16]);
    return validateKey([values[0], values[2]]);
}
const unchanged = (row, revision) => (row?.source_revision ?? null) === revision;
const retry = () => ({ rows: [], rowCount: 0 });

/** Dedicated idle client, one persistence call at a time. Analysis remains in the existing service, outside transactions. */
export function createScopedSyncAdapter(db) {
    const sql = scopedSyncQueries();
    let busy = false;
    return async (operation, values) => {
        if (busy) throw new Error('Concurrent use of scoped sync adapter');
        if (operation === READ_SYNC_ITEM) {
            if (!Array.isArray(values) || values.length !== 2) throw new Error('Invalid sync read contract');
            validateKey(values);
        } else if (operation === UPSERT_SYNC_ITEM) validateWrite(values);
        else throw new Error('Unsupported scoped sync operation');
        busy = true;
        try {
            if (operation === READ_SYNC_ITEM) return await db.query(sql.read, values);
            const key = [values[0], values[2]], identityLock = validateKey(key);
            await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
            try {
                await lockScopedRepairLibraries(db, 'disposable', [], 'write');
                await db.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', [SYNC_IDENTITY_LOCK_NAMESPACE, identityLock]);
                const before = (await db.query(sql.membership, key)).rows[0];
                let result = retry();
                if (unchanged(before, values[17])) {
                    await lockScopedRepairLibraries(db, 'disposable', [before?.library_id ?? null, values[1]], 'write');
                    const current = (await db.query(sql.membership, key)).rows[0];
                    if (unchanged(current, values[17]) && (current?.library_id ?? null) === (before?.library_id ?? null)) result = await db.query(sql.upsert, values);
                }
                await db.query('COMMIT');
                return result;
            } catch (error) { await db.query('ROLLBACK'); throw error; }
        } finally { busy = false; }
    };
}
