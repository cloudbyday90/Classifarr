/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const TABLES = Object.freeze(['scoped_repair_source', 'scoped_repair_heads', 'scoped_repair_pages', 'sync_servers', 'sync_libraries',
    'cleanup_jobs', 'cleanup_seen', 'cleanup_item_claims', 'cleanup_retries', 'cleanup_previews', 'cleanup_collections', 'cleanup_status', 'cleanup_history',
    'cleanup_requests', 'cleanup_feedback']);

async function fingerprint(db) {
    const row = (await db.query(`WITH watched AS (SELECT c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='scoped_repair_lab' AND c.relname=ANY($1::text[])), records AS (
        SELECT 'table:'||w.relname key,jsonb_build_object('kind',w.relkind,'rls',w.relrowsecurity,'forceRls',w.relforcerowsecurity) value FROM watched w
        UNION ALL SELECT 'column:'||a.attrelid::text||':'||a.attnum::text,jsonb_build_object('name',a.attname,'type',a.atttypid,
            'notNull',a.attnotnull,'generated',a.attgenerated,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid))
            FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
            WHERE a.attrelid IN (SELECT oid FROM watched) AND a.attnum>0 AND NOT a.attisdropped
        UNION ALL SELECT 'constraint:'||c.conrelid::text||':'||c.conname,jsonb_build_object('definition',pg_get_constraintdef(c.oid),
            'validated',c.convalidated,'enforced',c.conenforced) FROM pg_catalog.pg_constraint c
            WHERE c.conrelid IN (SELECT oid FROM watched) OR c.confrelid IN (SELECT oid FROM watched)
        UNION ALL SELECT 'trigger:'||t.tgrelid::text||':'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid),
            'function',pg_get_functiondef(t.tgfoid),'enabled',t.tgenabled) FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid IN (SELECT oid FROM watched) AND NOT t.tgisinternal
        UNION ALL SELECT 'index:'||i.indexrelid::text,jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),
            'valid',i.indisvalid,'ready',i.indisready) FROM pg_catalog.pg_index i WHERE i.indrelid IN (SELECT oid FROM watched)
        UNION ALL SELECT 'rule:'||r.oid::text,jsonb_build_object('definition',pg_get_ruledef(r.oid),'enabled',r.ev_enabled)
            FROM pg_catalog.pg_rewrite r WHERE r.ev_class IN (SELECT oid FROM watched)
        UNION ALL SELECT 'function:'||p.oid::text,jsonb_build_object('kind',p.prokind,'definition',
            CASE WHEN p.prokind='a' THEN 'unreviewed_aggregate' ELSE pg_get_functiondef(p.oid) END)
            FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='scoped_repair_lab')
        SELECT (SELECT count(*)::integer FROM watched) tables,
            encode(sha256(convert_to(COALESCE(jsonb_agg(jsonb_build_object('key',key,'value',value) ORDER BY key),'[]'::jsonb)::text,'UTF8')),'hex') fingerprint
        FROM records`, [TABLES])).rows[0];
    if (row.tables !== TABLES.length) throw new Error('Dependent cleanup tables are incomplete');
    return row.fingerprint;
}

export async function recordDependentContract(db) {
    await db.query('CREATE TABLE scoped_repair_lab.cleanup_dependency_contract(singleton boolean PRIMARY KEY CHECK(singleton),fingerprint text NOT NULL)');
    await db.query('INSERT INTO scoped_repair_lab.cleanup_dependency_contract VALUES(true,$1)', [await fingerprint(db)]);
}

/** Table locks precede coordinator/library/row locks and prevent concurrent FK/trigger/index DDL on watched tables. */
export async function assertDependentContract(db) {
    await db.query(`LOCK TABLE ${TABLES.map(table => `scoped_repair_lab.${table}`).join(',')} IN ROW EXCLUSIVE MODE`);
    const expected = (await db.query('SELECT fingerprint FROM scoped_repair_lab.cleanup_dependency_contract WHERE singleton')).rows[0]?.fingerprint;
    if (!expected || await fingerprint(db) !== expected) throw new Error('Dependent cleanup schema contract changed');
}
