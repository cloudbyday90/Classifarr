/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RECOVERY_BENCHMARK_LIMITS, RECOVERY_STRATEGIES } from './model.mjs';
import { requireRecoveryBenchmarkTables } from './fixture.mjs';
import { countRecoveryBenchmarkRows, projectRecoveryBenchmarkRows, RECOVERY_SOURCE_SQL, RECOVERY_COUNT_FIELDS } from './projection.mjs';

const ms = start => Math.round((performance.now() - start) * 100) / 100;

/** Prototype measurement against owned temporary fixtures; never a production sampler. */
export async function probeLibraryScanRecovery(db, strategy) {
    if (!RECOVERY_STRATEGIES.includes(strategy)) throw new RangeError('Invalid recovery strategy');
    await requireRecoveryBenchmarkTables(db);
    const limit = strategy === 'current' ? RECOVERY_BENCHMARK_LIMITS.pageRows : RECOVERY_BENCHMARK_LIMITS.frozenRows;
    const started = performance.now();
    const snapshot = (await db.query(RECOVERY_SOURCE_SQL, [limit + 1, limit, strategy === 'frozen_projection'])).rows[0];
    const captureMs = ms(started);
    const sourceTransferBytes = Buffer.byteLength(JSON.stringify(snapshot));
    const reducedAt = performance.now();
    const compact = projectRecoveryBenchmarkRows(snapshot.items);
    const reductionMs = ms(reducedAt);
    const exceeded = snapshot.lookahead_rows > limit;
    let storedRows = 0, storageBytes = 0, storageWriteMs = 0, storedReadMs = 0, sourceMutationMs = 0, frozenUnaffectedByChange = null;
    let counts = countRecoveryBenchmarkRows(compact);
    if (strategy === 'frozen_projection' && !exceeded) {
        const storeAt = performance.now();
        await db.query(`INSERT INTO pg_temp.recovery_benchmark_frozen
            SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(id integer,supported boolean,identified boolean,
                captured boolean,fresh boolean,keywords boolean,language boolean)`, [JSON.stringify(compact)]);
        storageWriteMs = ms(storeAt);
        const size = (await db.query(`SELECT count(*)::integer AS rows,
            pg_total_relation_size('pg_temp.recovery_benchmark_frozen'::regclass)::integer AS bytes
            FROM pg_temp.recovery_benchmark_frozen`)).rows[0];
        storedRows = size.rows; storageBytes = size.bytes;
        // Source changes after capture must not modify the frozen measurement baseline.
        const mutationAt = performance.now();
        await db.query("UPDATE pg_temp.recovery_benchmark_source SET metadata='{}' WHERE library_id=1");
        sourceMutationMs = ms(mutationAt);
        const readAt = performance.now();
        const restored = Object.fromEntries(RECOVERY_COUNT_FIELDS.map(field => [field, 0]));
        let after = 0;
        for (let page = 0; page < 2; page++) {
            const rows = (await db.query('SELECT * FROM pg_temp.recovery_benchmark_frozen WHERE id>$1 ORDER BY id LIMIT 20000', [after])).rows;
            const pageCounts = countRecoveryBenchmarkRows(rows);
            for (const field of RECOVERY_COUNT_FIELDS) restored[field] += pageCounts[field];
            if (rows.length) after = rows.at(-1).id;
        }
        storedReadMs = ms(readAt);
        frozenUnaffectedByChange = RECOVERY_COUNT_FIELDS.every(field => counts[field] === restored[field]);
        counts = restored;
    }
    return { strategy, lookaheadRows: snapshot.lookahead_rows, metadataRowsRead: snapshot.items.length,
        complete: !exceeded, capacityRefused: strategy === 'frozen_projection' && exceeded,
        counts: exceeded ? null : counts, storedRows, storageBytes, sourceTransferBytes,
        captureMs, reductionMs, storageWriteMs, storedReadMs, sourceMutationMs, frozenUnaffectedByChange,
        elapsedMs: Math.round((ms(started) - sourceMutationMs) * 100) / 100 };
}
