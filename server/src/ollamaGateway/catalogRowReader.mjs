/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { catalogTables, CATALOG_COLUMNS, CATALOG_JOB_COLUMNS, CATALOG_COUNTS, CATALOG_ROW_LIMIT } from './catalogContract.mjs';
import { archiveUuid } from './archiveRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

/** Fixed-schema cursor inside the caller's UTC repeatable-read snapshot. */
async function visitRows(client, index, consume, signal, version, selection) {
  const table = catalogTables(version)[index], dependencies = selection !== undefined;
  if (!table || (dependencies && index !== 0)) throw gatewayError('gateway_catalog_contract');
  signal?.throwIfAborted();
  const columns = (await client.query(`SELECT string_agg(attname||':'||format_type(atttypid,atttypmod),',' ORDER BY attnum) AS columns
    FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped`, [table])).rows[0].columns;
  if (columns !== (CATALOG_COLUMNS[index] ?? CATALOG_JOB_COLUMNS)) throw gatewayError('gateway_catalog_schema');
  // Every row retains size/count validation, including excluded failed history.
  // CASE bounds each body before transfer; identifiers come only from catalogTables.
  const projection = dependencies ? `id,octet_length(to_jsonb(t)::text) AS bytes,
    status='verified' AND ($2::uuid[] IS NULL OR id=ANY($2::uuid[])) AS required,
    CASE WHEN status='verified' AND ($2::uuid[] IS NULL OR id=ANY($2::uuid[]))
      THEN CASE WHEN octet_length(to_jsonb(t)::text)<=$1 THEN to_jsonb(t)::text END END AS row` :
    'id,CASE WHEN octet_length(to_jsonb(t)::text)<=$1 THEN to_jsonb(t)::text END AS row';
  await client.query(`DECLARE gateway_catalog_cursor NO SCROLL CURSOR FOR
    SELECT ${projection} FROM ${table} t ORDER BY id`, dependencies ? [CATALOG_ROW_LIMIT, selection] : [CATALOG_ROW_LIMIT]);
  let count = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const rows = (await client.query('FETCH FORWARD 16 FROM gateway_catalog_cursor')).rows;
      if (!rows.length) break;
      for (const row of rows) {
        signal?.throwIfAborted();
        if (++count > (CATALOG_COUNTS[index] ?? 10000)) throw gatewayError('gateway_catalog_size_limit');
        if (dependencies) {
          if (!Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > CATALOG_ROW_LIMIT || typeof row.required !== 'boolean') {
            throw gatewayError('gateway_catalog_size_limit');
          }
          if (!row.required) {
            if (row.row !== null) throw gatewayError('gateway_catalog_size_limit');
            continue;
          }
        }
        if (typeof row.row !== 'string' || Buffer.byteLength(row.row) > CATALOG_ROW_LIMIT ||
            (dependencies && Buffer.byteLength(row.row) !== row.bytes)) throw gatewayError('gateway_catalog_size_limit');
        await consume({ id: row.id, row: row.row });
      }
    }
  } finally { await client.query('CLOSE gateway_catalog_cursor'); }
}

export function visitCatalogRows(client, index, consume, signal, version = 1) {
  return visitRows(client, index, consume, signal, version, undefined);
}

/** Null selects all verified jobs; an empty set still validates all history. */
export function visitCatalogDependencyRows(client, consume, signal, selected = null) {
  if (selected !== null && (!(selected instanceof Set) || selected.size > 10000 || ![...selected].every(archiveUuid))) {
    throw gatewayError('gateway_catalog_contract');
  }
  return visitRows(client, 0, consume, signal, 1, selected === null ? null : [...selected]);
}
