/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { scopedRepairNamespace, SCOPED_REPAIR_LIMITS as limits } from './contract.mjs';
import { installScopedRepairTriggers } from './triggers.mjs';

/** Install only in a caller-owned transaction; no application migration or extension. */
export async function installScopedRepairPrototype(db, scope) {
    const ns = scopedRepairNamespace(scope);
    if (scope === 'disposable') {
        const { name } = (await db.query('SELECT current_database() AS name')).rows[0];
        if (name !== 'scan_recovery_benchmark' && !/^classifarr_suite_[a-f0-9]{12}$/.test(name)) throw new Error('Scoped repair requires a disposable database');
        await db.query(`CREATE SCHEMA ${ns}`);
    }
    const table = scope === 'temporary' ? 'TEMP TABLE' : 'TABLE', lifetime = scope === 'temporary' ? ' ON COMMIT DROP' : '';
    await db.query(`CREATE ${table} ${ns}.scoped_repair_source(id integer PRIMARY KEY CHECK(id>0),
        library_id integer CHECK(library_id>0),media_type text,tmdb_id integer,metadata jsonb,
        inventory_tmdb_attempted_at timestamptz,inventory_tmdb_fetched_at timestamptz)${lifetime};
        CREATE INDEX ON ${ns}.scoped_repair_source(library_id,id);
        CREATE ${table} ${ns}.scoped_repair_heads(slot integer PRIMARY KEY CHECK(slot>=0 AND slot<${limits.libraries}),
            library_id integer UNIQUE CHECK(library_id>0),epoch uuid,revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
            invalidated_through bigint NOT NULL DEFAULT 0 CHECK(invalidated_through>=0),cursor_id integer NOT NULL DEFAULT 0 CHECK(cursor_id>=0),
            built boolean NOT NULL DEFAULT false,restart_reason text,started_at timestamptz,last_seen_at timestamptz)${lifetime};
        INSERT INTO ${ns}.scoped_repair_heads(slot) SELECT generate_series(0,${limits.libraries - 1});
        CREATE ${table} ${ns}.scoped_repair_pages(slot integer PRIMARY KEY CHECK(slot>=0 AND slot<${limits.pages}),
            owner integer REFERENCES ${ns}.scoped_repair_heads(slot),low_id integer,high_id integer,
            counts jsonb,digest text,dirty_since bigint,measured_at timestamptz,expires_at timestamptz,
            UNIQUE(owner,low_id),CHECK(owner IS NULL OR (low_id>=0 AND high_id>low_id)))${lifetime};
        INSERT INTO ${ns}.scoped_repair_pages(slot) SELECT generate_series(0,${limits.pages - 1});`);
    await installScopedRepairTriggers(db, ns);
}
