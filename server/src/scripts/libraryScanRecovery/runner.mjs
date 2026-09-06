/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createRecoveryBenchmarkFixture } from './fixture.mjs';
import { probeLibraryScanRecovery } from './probe.mjs';
import { buildRecoveryModelReport, RECOVERY_STRATEGIES } from './model.mjs';

const statistics = values => {
    const ordered = [...values].sort((a, b) => a - b);
    return { min: ordered[0], median: ordered[Math.floor(ordered.length / 2)], max: ordered.at(-1) };
};

export async function runLibraryScanRecoveryMeasurements(db) {
    const measurements = [];
    for (const rows of [20000, 20001, 40000, 40001]) {
        for (const strategy of RECOVERY_STRATEGIES) {
            const repetitions = [];
            for (let repetition = 0; repetition < 3; repetition++) {
                await db.query('BEGIN');
                try {
                    await db.query("SET LOCAL statement_timeout='15s'; SET LOCAL idle_in_transaction_session_timeout='30s'");
                    await createRecoveryBenchmarkFixture(db, rows);
                    repetitions.push(await probeLibraryScanRecovery(db, strategy));
                } finally { await db.query('ROLLBACK'); }
            }
            measurements.push({ rows, strategy, repetitions, elapsedMs: statistics(repetitions.map(result => result.elapsedMs)) });
        }
    }
    const remaining = (await db.query(`SELECT count(*)::integer AS count FROM pg_class WHERE relnamespace=pg_my_temp_schema()
        AND relname IN ('recovery_benchmark_source','recovery_benchmark_frozen')`)).rows[0].count;
    if (remaining !== 0) throw new Error('Recovery benchmark rollback verification failed');
    return { ...buildRecoveryModelReport(), databaseEvidence: { kind: 'isolated_postgresql_prototypes',
        measurements, rollbackVerified: true, providerRequests: 0, classificationWrites: 0,
        limitations: ['synthetic_metadata', 'prototype_not_production_recovery', 'no_cross_visit_durability_proof',
            'scheduled_gaps_exclude_database_contention'] } };
}
