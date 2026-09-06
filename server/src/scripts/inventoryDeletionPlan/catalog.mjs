/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildInventoryDeletionPlan, DELETION_ROOTS, DELETION_PLAN_LIMITS } from './graph.mjs';

const actions = Object.freeze({ a: 'NO_ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET_NULL', d: 'SET_DEFAULT' });

/** Dedicated idle connection. Catalog only: never reads source rows or emits function bodies. */
export async function readInventoryDeletionPlan(db, roots = DELETION_ROOTS) {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
        await db.query("SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'");
        const constraints = (await db.query(`SELECT format('%I.%I',cn.nspname,child.relname)||'.'||c.conname id,
            format('%I.%I',pn.nspname,parent.relname) parent,format('%I.%I',cn.nspname,child.relname) child,
            c.confdeltype action,c.convalidated validated,c.conenforced enforced,c.condeferrable deferrable,
            ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(att,ord)
                JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.att ORDER BY k.ord) child_columns,
            ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(att,ord)
                JOIN pg_catalog.pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.att ORDER BY k.ord) parent_columns,
            EXISTS(SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid
                JOIN pg_catalog.pg_am am ON am.oid=ic.relam WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indisready
                AND i.indpred IS NULL AND am.amname='btree' AND i.indnkeyatts>=cardinality(c.conkey)
                AND ARRAY(SELECT k.att FROM unnest(i.indkey) WITH ORDINALITY k(att,ord)
                    WHERE k.ord<=cardinality(c.conkey) ORDER BY k.att)=ARRAY(SELECT unnest(c.conkey) ORDER BY 1)) child_index
            FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class child ON child.oid=c.conrelid
            JOIN pg_catalog.pg_namespace cn ON cn.oid=child.relnamespace
            JOIN pg_catalog.pg_class parent ON parent.oid=c.confrelid JOIN pg_catalog.pg_namespace pn ON pn.oid=parent.relnamespace
            WHERE c.contype='f' AND left(cn.nspname,3)<>'pg_' AND cn.nspname<>'information_schema'
            ORDER BY cn.nspname,child.relname,c.conname LIMIT $1`, [DELETION_PLAN_LIMITS.edges + 1])).rows;
        const edges = constraints.map(row => ({ id: row.id, parent: row.parent, child: row.child,
            onDelete: actions[row.action] ?? 'UNKNOWN', childColumns: row.child_columns, parentColumns: row.parent_columns,
            validated: row.validated, enforced: row.enforced, deferrable: row.deferrable, childIndex: row.child_index }));
        const tables = (await db.query(`SELECT format('%I.%I',n.nspname,c.relname) name,c.relkind kind,c.relrowsecurity rls
            FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
            WHERE c.relkind IN ('r','p','f') AND left(n.nspname,3)<>'pg_' AND n.nspname<>'information_schema'
            ORDER BY n.nspname,c.relname LIMIT 10001`)).rows;
        const triggers = (await db.query(`SELECT format('%I.%I',n.nspname,c.relname) AS table,t.tgname name,t.tgenabled enabled,
            md5(pg_get_triggerdef(t.oid)||pg_get_functiondef(t.tgfoid)) definition_digest
            FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal
            AND left(n.nspname,3)<>'pg_' AND n.nspname<>'information_schema'
            ORDER BY n.nspname,c.relname,t.tgname LIMIT 10001`)).rows;
        const rules = (await db.query(`SELECT format('%I.%I',n.nspname,c.relname) AS table,r.rulename name,r.ev_enabled enabled,
            md5(pg_get_ruledef(r.oid)) definition_digest FROM pg_catalog.pg_rewrite r JOIN pg_catalog.pg_class c ON c.oid=r.ev_class
            JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE left(n.nspname,3)<>'pg_' AND n.nspname<>'information_schema'
            AND r.rulename<>'_RETURN' ORDER BY n.nspname,c.relname,r.rulename LIMIT 10001`)).rows;
        if (tables.length > 10000 || triggers.length > 10000 || rules.length > 10000) throw new Error('Deletion catalog budget exceeded');
        const clock = (await db.query("SELECT transaction_timestamp()::text measured_at,current_setting('server_version') version")).rows[0];
        const result = buildInventoryDeletionPlan({ source: { kind: 'postgres_catalog', version: clock.version },
            measuredAt: clock.measured_at, edges, tables, triggers, rules }, roots);
        await db.query('COMMIT');
        return { ...result, itemRowsRead: 0, writes: 0 };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
}
