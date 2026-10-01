/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { IMAGE_INDEXES } from './imageIndexMaintenanceContract.mjs';

/** Include same-name non-index objects: absence of pg_index is not permission to replace them. */
export async function inspectImageIndexes(query) {
  const { rows } = await query(`SELECT c.relname AS name, c.relkind, am.amname AS method,
    i.indrelid = to_regclass('public.classification_embeddings') AS expected_table,
    i.indisvalid AS valid, i.indisready AS ready, i.indislive AS live,
    i.indisunique OR i.indisprimary OR i.indisexclusion OR i.indisreplident AS special,
    i.indexprs IS NOT NULL AS expressions, i.indnatts = i.indnkeyatts AS keys_only,
    EXISTS (SELECT 1 FROM pg_constraint co WHERE co.conindid = c.oid) AS constrained,
    pg_get_expr(i.indpred, i.indrelid) AS predicate, COALESCE(c.reloptions, ARRAY[]::text[]) AS options,
    ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum, n)
      LEFT JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum ORDER BY k.n) AS columns,
    ARRAY(SELECT op.opcname::text FROM unnest(i.indclass) WITH ORDINALITY k(oid, n)
      JOIN pg_opclass op ON op.oid = k.oid ORDER BY k.n) AS opclasses,
    NOT EXISTS (SELECT 1 FROM unnest(i.indoption) opt WHERE opt <> 0) AS default_order,
    NOT EXISTS (SELECT 1 FROM unnest(i.indkey::smallint[], i.indcollation::oid[]) k(attnum, collid)
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
      WHERE k.collid <> a.attcollation) AS default_collation
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_index i ON i.indexrelid = c.oid LEFT JOIN pg_am am ON am.oid = c.relam
    WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`, [IMAGE_INDEXES.map(index => index.name)]);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return IMAGE_INDEXES.map(index => {
    const row = rows.find(value => value.name === index.name);
    if (!row) return { index, action: 'create' };
    if (row.relkind !== 'i' || row.expected_table !== true || row.method !== index.accessMethod
      || row.special !== false || row.expressions !== false || row.constrained !== false
      || row.keys_only !== true || row.default_order !== true || row.default_collation !== true
      || row.predicate !== index.predicate || !same(row.columns, index.columns)
      || !same(row.opclasses, index.opclasses) || !same([...row.options].sort(), index.options)) {
      throw new Error('image_index_definition_mismatch');
    }
    return { index, action: row.valid && row.ready && row.live ? 'preserve' : 'repair' };
  });
}
