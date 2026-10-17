/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ARCHIVE_TABLES, ARCHIVE_LIMIT } from './archiveContract.mjs';
import { gatewayError } from './errors.mjs';

/** Call inside one UTC, read-only repeatable-read transaction. Never materialize a table in JS.
 * @param {any} client
 * @param {AbortSignal} [signal]
 * @param {any} [prefixes]
 * @param {{bytes: number, rowLimit?: number}} [budget]
 */
export async function captureArchiveContent(client, signal, prefixes = null, budget = { bytes: 0 }) {
  const content = {};
  for (const table of ARCHIVE_TABLES) {
    const digest = createHash('sha256'); let count = 0, maxId = null;
    // The identifier comes only from the fixed seven-table contract, never from a manifest.
    const upper = prefixes ? prefixes[table].maxId : null;
    await client.query(`DECLARE archive_content_cursor NO SCROLL CURSOR FOR
      SELECT id,CASE WHEN $3::integer IS NULL OR octet_length(to_jsonb(t)::text)<=$3 THEN to_jsonb(t)::text END AS row FROM ollama_gateway.${table} t
      WHERE ($1::uuid IS NULL OR id <= $1::uuid) AND $2::boolean ORDER BY id`, [upper, !prefixes || upper !== null, budget.rowLimit ?? null]);
    try {
      for (;;) {
        signal?.throwIfAborted();
        const rows = (await client.query('FETCH FORWARD 256 FROM archive_content_cursor')).rows;
        if (!rows.length) break;
        for (const row of rows) {
          if (typeof row.row !== 'string') throw gatewayError('gateway_archive_size_limit');
          budget.bytes += Buffer.byteLength(row.row) + 1; count++; maxId = row.id;
          if (count > 200000 || budget.bytes > ARCHIVE_LIMIT) throw gatewayError('gateway_archive_size_limit');
          digest.update(row.row).update('\n');
        }
      }
    } finally { await client.query('CLOSE archive_content_cursor'); }
    content[table] = { count, maxId, sha256: digest.digest('hex') };
  }
  return content;
}

export function preservesArchiveContent(replacement, prior) {
  return ARCHIVE_TABLES.filter(name => name !== 'admission').every(name =>
    replacement[name].count === prior[name].count && replacement[name].maxId === prior[name].maxId &&
    replacement[name].sha256 === prior[name].sha256);
}
