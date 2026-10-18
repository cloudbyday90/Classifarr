/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

/** Public deterministic synthetic data, not a credential or security PRNG. */
export function studyPadding(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 3000) throw new Error('study_history_index_invalid');
  return createHash('shake256', { outputLength: 56250 }).update(`classifarr-public-study-v1:${index}`).digest('base64url');
}

export async function failedHistoryEvidence(client) {
  const rows = (await client.query(`SELECT id,encode(sha256(convert_to(to_jsonb(j)::text,'UTF8')),'hex') AS hash,
    octet_length(to_jsonb(j)::text)+1 AS bytes FROM gateway_archive.job j WHERE status='failed' ORDER BY id LIMIT 3001`)).rows;
  if (rows.length !== 3000) throw new Error('study_history_count_invalid');
  const hash = createHash('sha256'); let bytes = 0;
  for (const row of rows) { hash.update(`${row.id}:${row.hash}\n`); bytes += row.bytes; }
  const storage = (await client.query(`SELECT pg_relation_size(c.oid)::float8 AS main_bytes,
    pg_indexes_size(c.oid)::float8 AS index_bytes,pg_total_relation_size(c.reltoastrelid)::float8 AS toast_bytes,
    pg_total_relation_size(c.oid)::float8 AS total_bytes FROM pg_class c WHERE c.oid='gateway_archive.job'::regclass`)).rows[0];
  return { rows: rows.length, bytes, sha256: hash.digest('hex'), storage, dumpCompression: 0 };
}
