/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export async function createRecoveryBenchmarkFixture(db, rows) {
    if (!Number.isInteger(rows) || rows < 1 || rows > 80001) throw new RangeError('Invalid benchmark fixture size');
    await db.query(`CREATE TEMP TABLE recovery_benchmark_source (
        id integer PRIMARY KEY,library_id integer NOT NULL,media_type text,tmdb_id integer,metadata jsonb,
        inventory_tmdb_attempted_at timestamptz,inventory_tmdb_fetched_at timestamptz) ON COMMIT DROP;
        CREATE INDEX ON recovery_benchmark_source(library_id,id);
        CREATE TEMP TABLE recovery_benchmark_frozen (id integer PRIMARY KEY,supported boolean,identified boolean,
            captured boolean,fresh boolean,keywords boolean,language boolean) ON COMMIT DROP`);
    await db.query(`INSERT INTO pg_temp.recovery_benchmark_source
        SELECT id,1,'movie',id,jsonb_build_object('inventory_tmdb',jsonb_build_object('version',1,
            'media_type','movie','tmdb_id',id,'keywords',jsonb_build_array('space'),'original_language','en')),
            '2026-08-01T00:00:00Z'::timestamptz,'2026-08-01T00:00:00Z'::timestamptz
        FROM generate_series(1,$1::integer) id`, [rows]);
    await db.query('ANALYZE pg_temp.recovery_benchmark_source');
}

export async function requireRecoveryBenchmarkTables(db) {
    const { rows } = await db.query(`SELECT count(*)::integer AS count FROM pg_class
        WHERE relnamespace=pg_my_temp_schema() AND relpersistence='t'
            AND relname IN ('recovery_benchmark_source','recovery_benchmark_frozen')`);
    if (rows[0].count !== 2) throw new Error('Recovery benchmark requires its temporary fixture tables');
}
