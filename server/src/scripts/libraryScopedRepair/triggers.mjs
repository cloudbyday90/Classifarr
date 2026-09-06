/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SCOPED_REPAIR_LIMITS as limits, SCOPED_REPAIR_LOCK_NAMESPACE } from './contract.mjs';

export async function installScopedRepairTriggers(db, ns) {
    for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
        const changes = operation === 'INSERT' ? 'SELECT id,library_id FROM new_rows' : operation === 'DELETE' ?
            'SELECT id,library_id FROM old_rows' : 'SELECT id,library_id FROM old_rows UNION SELECT id,library_id FROM new_rows';
        const relations = operation === 'INSERT' ? 'NEW TABLE AS new_rows' : operation === 'DELETE' ? 'OLD TABLE AS old_rows' :
            'OLD TABLE AS old_rows NEW TABLE AS new_rows';
        const name = `scoped_repair_${operation.toLowerCase()}`;
        await db.query(`CREATE FUNCTION ${ns}.${name}() RETURNS trigger LANGUAGE plpgsql AS $body$
        DECLARE watched record; next_revision bigint; too_many boolean; missing_range boolean;
        BEGIN
            IF EXISTS(SELECT 1 FROM (${changes}) c WHERE c.library_id IS NOT NULL AND NOT EXISTS(
                SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='advisory' AND l.pid=pg_backend_pid()
                AND l.granted AND l.mode='ExclusiveLock' AND l.classid=${SCOPED_REPAIR_LOCK_NAMESPACE}::oid
                AND l.objid=c.library_id::oid AND l.objsubid=2)) THEN
                RAISE EXCEPTION 'Scoped source write requires declared library locks' USING ERRCODE='55000';
            END IF;
            FOR watched IN SELECT h.* FROM ${ns}.scoped_repair_heads h
                WHERE h.library_id IN (SELECT library_id FROM (${changes}) c) ORDER BY h.library_id FOR UPDATE LOOP
                next_revision := watched.revision+1;
                SELECT count(*)>${limits.mutations} INTO too_many FROM (
                    SELECT DISTINCT id FROM (${changes}) c WHERE c.library_id=watched.library_id LIMIT ${limits.mutations + 1}
                ) bounded;
                SELECT EXISTS(SELECT 1 FROM (${changes}) c WHERE c.library_id=watched.library_id
                    AND c.id<=watched.cursor_id AND NOT EXISTS(SELECT 1 FROM ${ns}.scoped_repair_pages p
                        WHERE p.owner=watched.slot AND c.id>p.low_id AND c.id<=p.high_id)) INTO missing_range;
                UPDATE ${ns}.scoped_repair_pages p SET dirty_since=COALESCE(p.dirty_since,next_revision)
                    WHERE p.owner=watched.slot AND EXISTS(SELECT 1 FROM (${changes}) c
                        WHERE c.library_id=watched.library_id AND c.id>p.low_id AND c.id<=p.high_id);
                UPDATE ${ns}.scoped_repair_heads SET revision=next_revision,invalidated_through=next_revision,
                    restart_reason=COALESCE(restart_reason,CASE
                        WHEN watched.revision<>watched.invalidated_through THEN 'missing_invalidation'
                        WHEN too_many THEN 'change_batch_overflow' WHEN missing_range THEN 'unmapped_change' END)
                    WHERE slot=watched.slot;
            END LOOP;
            RETURN NULL;
        END $body$;
        CREATE TRIGGER ${name} AFTER ${operation} ON ${ns}.scoped_repair_source REFERENCING ${relations}
            FOR EACH STATEMENT EXECUTE FUNCTION ${ns}.${name}();`);
    }
    // The exclusive source-table lock precedes every compliant library lock.
    await db.query(`CREATE FUNCTION ${ns}.scoped_repair_truncate() RETURNS trigger LANGUAGE plpgsql AS $body$
        BEGIN UPDATE ${ns}.scoped_repair_heads SET revision=revision+1,invalidated_through=revision+1,restart_reason='unsupported_change'
            WHERE library_id IS NOT NULL; RETURN NULL; END $body$;
        CREATE TRIGGER scoped_repair_truncate AFTER TRUNCATE ON ${ns}.scoped_repair_source
            FOR EACH STATEMENT EXECUTE FUNCTION ${ns}.scoped_repair_truncate();`);
}
