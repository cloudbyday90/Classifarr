/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { scopedRepairNamespace, orderedScopedLibraries, SCOPED_REPAIR_LOCK_NAMESPACE } from './contract.mjs';

/** Internal variant for caller-owned temporary assessment transactions. Never acquire row locks first. */
export async function lockScopedRepairLibraries(db, scope, ids, mode) {
    const ns = scopedRepairNamespace(scope), libraries = orderedScopedLibraries(ids);
    if (!['read', 'write'].includes(mode)) throw new Error('Invalid scoped repair lock mode');
    if ((await db.query('SHOW transaction_isolation')).rows[0].transaction_isolation !== 'read committed') throw new Error('Scoped repair requires read committed');
    await db.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'");
    await db.query(`LOCK TABLE ${ns}.scoped_repair_source IN ${mode === 'write' ? 'ROW EXCLUSIVE' : 'ACCESS SHARE'} MODE`);
    // Separate calls deliberately avoid SQL expression evaluation/order ambiguity.
    for (const libraryId of libraries) await db.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', [SCOPED_REPAIR_LOCK_NAMESPACE, libraryId]);
    return ns;
}

/** Dedicated idle client; the callback must finish before the transaction is released. */
export async function withScopedRepairLibraries(db, scope, ids, mode, work) {
    scopedRepairNamespace(scope); orderedScopedLibraries(ids);
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    try {
        const ns = await lockScopedRepairLibraries(db, scope, ids, mode);
        const result = await work(ns);
        await db.query('COMMIT');
        return result;
    } catch (error) { await db.query('ROLLBACK'); throw error; }
}
