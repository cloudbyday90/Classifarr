/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { pageRepairNamespace, PAGE_REPAIR_LIMITS as limits } from './contract.mjs';

/** Caller owns an installation transaction. Never attach triggers to application tables. */
export async function installPageRepairPrototype(db, scope) {
    const ns = pageRepairNamespace(scope);
    if (scope === 'disposable') {
        const { name } = (await db.query('SELECT current_database() AS name')).rows[0];
        if (name !== 'scan_recovery_benchmark' && !/^classifarr_suite_[a-f0-9]{12}$/.test(name)) {
            throw new Error('Page repair requires a disposable database');
        }
        await db.query(`CREATE SCHEMA ${ns}`);
    }
    const table = scope === 'temporary' ? 'TEMP TABLE' : 'TABLE';
    const lifetime = scope === 'temporary' ? ' ON COMMIT DROP' : '';
    await db.query(`CREATE ${table} ${ns}.page_repair_source (
        id integer PRIMARY KEY CHECK(id>0), library_id integer CHECK(library_id>0), media_type text,
        tmdb_id integer, metadata jsonb, inventory_tmdb_attempted_at timestamptz, inventory_tmdb_fetched_at timestamptz
    )${lifetime};
    CREATE INDEX ON ${ns}.page_repair_source(library_id,id);
    CREATE ${table} ${ns}.page_repair_head (
        singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), generation bigint NOT NULL CHECK(generation>=0),
        sequence bigint NOT NULL CHECK(sequence>=0), reason text
    )${lifetime};
    INSERT INTO ${ns}.page_repair_head VALUES(true,0,0,NULL);
    CREATE ${table} ${ns}.page_repair_journal (
        slot integer PRIMARY KEY CHECK(slot>=0 AND slot<${limits.journal}), sequence bigint NOT NULL UNIQUE,
        library_id integer NOT NULL CHECK(library_id>0), page_id integer NOT NULL CHECK(page_id>=0)
    )${lifetime};
    CREATE ${table} ${ns}.page_repair_state (
        library_id integer PRIMARY KEY CHECK(library_id>0), generation bigint NOT NULL,
        acknowledged_sequence bigint NOT NULL, cursor_page integer NOT NULL DEFAULT -1,
        started_at timestamptz NOT NULL, last_observed_at timestamptz NOT NULL
    )${lifetime};
    CREATE ${table} ${ns}.page_repair_pages (
        library_id integer NOT NULL REFERENCES ${ns}.page_repair_state(library_id) ON DELETE CASCADE,
        page_id integer NOT NULL, counts jsonb, digest text, dirty_since bigint,
        measured_at timestamptz, expires_at timestamptz, PRIMARY KEY(library_id,page_id)
    )${lifetime};`);

    for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
        const pairs = name => `SELECT library_id,(id-1)/${limits.pageWidth} AS page_id FROM ${name} WHERE library_id IS NOT NULL`;
        const changes = operation === 'INSERT' ? pairs('new_rows') : operation === 'DELETE' ? pairs('old_rows') :
            `${pairs('old_rows')} UNION ${pairs('new_rows')}`;
        const relations = operation === 'INSERT' ? 'NEW TABLE AS new_rows' : operation === 'DELETE' ? 'OLD TABLE AS old_rows' :
            'OLD TABLE AS old_rows NEW TABLE AS new_rows';
        const name = `page_repair_${operation.toLowerCase()}`;
        await db.query(`CREATE FUNCTION ${ns}.${name}() RETURNS trigger LANGUAGE plpgsql AS $body$
        DECLARE before_sequence bigint; affected jsonb;
        BEGIN
            SELECT sequence INTO STRICT before_sequence FROM ${ns}.page_repair_head WHERE singleton FOR UPDATE;
            SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) INTO affected FROM (
                SELECT DISTINCT library_id,page_id FROM (${changes}) changed ORDER BY library_id,page_id LIMIT ${limits.journal + 1}
            ) p;
            IF jsonb_array_length(affected)>${limits.journal} THEN
                UPDATE ${ns}.page_repair_head SET generation=generation+1,sequence=sequence+1,reason='journal_overflow';
                DELETE FROM ${ns}.page_repair_journal;
            ELSE
                INSERT INTO ${ns}.page_repair_journal(slot,sequence,library_id,page_id)
                SELECT ((before_sequence+ordinal)%${limits.journal})::integer,before_sequence+ordinal,
                    (value->>'library_id')::integer,(value->>'page_id')::integer
                FROM jsonb_array_elements(affected) WITH ORDINALITY AS pair(value,ordinal)
                ON CONFLICT(slot) DO UPDATE SET sequence=EXCLUDED.sequence,library_id=EXCLUDED.library_id,page_id=EXCLUDED.page_id;
                UPDATE ${ns}.page_repair_head SET sequence=before_sequence+jsonb_array_length(affected);
            END IF;
            RETURN NULL;
        END $body$;
        CREATE TRIGGER ${name} AFTER ${operation} ON ${ns}.page_repair_source
            REFERENCING ${relations} FOR EACH STATEMENT EXECUTE FUNCTION ${ns}.${name}();`);
    }
    await db.query(`CREATE FUNCTION ${ns}.page_repair_truncate() RETURNS trigger LANGUAGE plpgsql AS $body$
        BEGIN
            UPDATE ${ns}.page_repair_head SET generation=generation+1,sequence=sequence+1,reason='unsupported_change';
            DELETE FROM ${ns}.page_repair_journal;
            RETURN NULL;
        END $body$;
        CREATE TRIGGER page_repair_truncate AFTER TRUNCATE ON ${ns}.page_repair_source
        FOR EACH STATEMENT EXECUTE FUNCTION ${ns}.page_repair_truncate();`);
}
