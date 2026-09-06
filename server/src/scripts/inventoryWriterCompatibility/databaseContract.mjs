/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Catalog-only assessment on a dedicated idle client; no configuration or item data is returned. */
export async function readWriterDatabaseContract(db) {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
        await db.query("SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'");
        const source = (await db.query(`SELECT c.oid,c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owns_source,
            has_table_privilege(c.oid,'INSERT') AS can_insert,has_table_privilege(c.oid,'UPDATE') AS can_update,
            has_table_privilege(c.oid,'DELETE') AS can_delete FROM pg_class c WHERE c.oid=to_regclass('public.media_server_items')`)).rows[0];
        const columns = (await db.query(`SELECT attname FROM pg_attribute
            WHERE attrelid=$1 AND attnum>0 AND NOT attisdropped ORDER BY attname`, [source?.oid ?? null])).rows.map(row => row.attname);
        const triggers = (await db.query(`SELECT tgname AS name,tgenabled AS enabled FROM pg_trigger
            WHERE tgrelid=$1 AND NOT tgisinternal ORDER BY tgname`, [source?.oid ?? null])).rows;
        const foreignKeys = (await db.query(`SELECT n.nspname AS parent_schema,p.relname AS parent_table,
            c.confdeltype AS delete_action,c.confupdtype AS update_action,c.convalidated AS validated
            FROM pg_constraint c JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace n ON n.oid=p.relnamespace
            WHERE c.conrelid=$1 AND c.contype='f' ORDER BY n.nspname,p.relname`, [source?.oid ?? null])).rows;
        const version = (await db.query('SHOW server_version')).rows[0].server_version;
        const measuredAt = (await db.query('SELECT transaction_timestamp()::text AS measured_at')).rows[0].measured_at;
        await db.query('COMMIT');
        return { contract: 'inventory.writer-database-contract.v1', measuredAt, postgresVersion: version, sourceFound: Boolean(source),
            observationClockColumns: columns.filter(name => ['inventory_tmdb_attempted_at', 'inventory_tmdb_fetched_at'].includes(name)),
            triggers, foreignKeys, privileges: source ? { ownsSource: source.owns_source, insert: source.can_insert, update: source.can_update, delete: source.can_delete } : null,
            itemRowsRead: 0, writes: 0, productionCompatible: false };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
}
