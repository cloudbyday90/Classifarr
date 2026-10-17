/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { catalogTables, CATALOG_COLUMNS, CATALOG_JOB_COLUMNS, CATALOG_COUNTS, CATALOG_ROW_LIMIT } from './catalogContract.mjs';
import { gatewayError } from './errors.mjs';

/** Fixed-schema cursor, inside the caller's UTC repeatable-read snapshot. */
export async function visitCatalogRows(client, index, consume, signal, version = 1) {
  const table = catalogTables(version)[index];
  if (!table) throw gatewayError('gateway_catalog_contract');
  const columns = (await client.query(`SELECT string_agg(attname||':'||format_type(atttypid,atttypmod),',' ORDER BY attnum) AS columns
    FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped`, [table])).rows[0].columns;
  if (columns !== (CATALOG_COLUMNS[index] ?? CATALOG_JOB_COLUMNS)) throw gatewayError('gateway_catalog_schema');
  // SQL returns NULL instead of transmitting oversized nested manifests to Node.
  await client.query(`DECLARE gateway_catalog_cursor NO SCROLL CURSOR FOR
    SELECT id,CASE WHEN octet_length(to_jsonb(t)::text)<=$1 THEN to_jsonb(t)::text END AS row
    FROM ${table} t ORDER BY id`, [CATALOG_ROW_LIMIT]);
  let count = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const rows = (await client.query('FETCH FORWARD 16 FROM gateway_catalog_cursor')).rows;
      if (!rows.length) break;
      for (const row of rows) {
        signal?.throwIfAborted();
        if (++count > (CATALOG_COUNTS[index] ?? 10000) || typeof row.row !== 'string' || Buffer.byteLength(row.row) > CATALOG_ROW_LIMIT) {
          throw gatewayError('gateway_catalog_size_limit');
        }
        await consume(row);
      }
    }
  } finally { await client.query('CLOSE gateway_catalog_cursor'); }
}

export async function captureCatalogContent(client, signal, budget, version = 1) {
  const tables = {};
  const names = catalogTables(version);
  for (let index = 0; index < names.length; index++) {
    const hash = createHash('sha256'); let count = 0, maxId = null;
    await visitCatalogRows(client, index, row => {
      budget.bytes += Buffer.byteLength(row.row) + 1;
      if (budget.bytes > 268435456) throw gatewayError('gateway_catalog_size_limit');
      hash.update(row.row).update('\n'); count++; maxId = row.id;
    }, signal, version);
    tables[names[index]] = { count, maxId, sha256: hash.digest('hex') };
  }
  return tables;
}
