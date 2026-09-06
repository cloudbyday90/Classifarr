/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { lockScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';

/** Dedicated idle client. No network/provider callbacks belong inside this transaction. */
export async function cleanupTransaction(db, work) {
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    try {
        await lockScopedRepairLibraries(db, 'disposable', [], 'write');
        const result = await work();
        await db.query('COMMIT');
        return result;
    } catch (error) { await db.query('ROLLBACK'); throw error; }
}
