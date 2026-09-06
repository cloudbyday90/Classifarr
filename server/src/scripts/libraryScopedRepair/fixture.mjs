/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireScopedRepairId } from './contract.mjs';
import { withScopedRepairLibraries } from './locking.mjs';

/** Generated observations only; fixture writes obey the same declared-library protocol. */
export async function seedScopedFixture(db, { rows, libraryId = 1, offset = 0, stride = 1 }) {
    requireScopedRepairId(libraryId);
    if (!Number.isInteger(rows) || rows < 1 || rows > 80001 || !Number.isInteger(offset) || offset < 0 ||
        !Number.isInteger(stride) || stride < 1) throw new Error('Invalid scoped fixture bounds');
    requireScopedRepairId(offset + rows * stride);
    await withScopedRepairLibraries(db, 'disposable', [libraryId], 'write', ns => db.query(`INSERT INTO ${ns}.scoped_repair_source
        (id,library_id,media_type,tmdb_id,metadata,inventory_tmdb_attempted_at,inventory_tmdb_fetched_at)
        SELECT id,$2,'movie',id,jsonb_build_object('inventory_tmdb',jsonb_build_object('version',1,'tmdb_id',id,
            'media_type','movie','keywords',jsonb_build_array('space'),'original_language','en')),
            '2026-08-01T00:00:00Z','2026-08-01T00:00:00Z'
        FROM (SELECT $3::integer+n*$4::integer id FROM generate_series(1,$1::integer) n) generated`, [rows, libraryId, offset, stride]));
}
