/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { ARCHIVE_HISTORY_FIELDS } from './archiveHistoryProjection.mjs';

// Operational read bound, not a new retention policy or permission to drop history.
// Repeated coordinator reads must fit the deployed 256 MiB process/container.
const HISTORY_BYTES = 8 * 1024 * 1024;

/** Complete ordered metadata only; never aggregate full evidence in the coordinator. */
export async function readArchiveHistory(client) {
  const result = await client.query(`WITH selected AS MATERIALIZED (
    SELECT ${ARCHIVE_HISTORY_FIELDS}
    FROM gateway_archive.job j LEFT JOIN gateway_archive.protection p ON p.id=j.recovery_protection_id
    ORDER BY j.created_at,j.id LIMIT 10001
  ), budget AS MATERIALIZED (
    SELECT count(*)::int AS history_count,coalesce(sum(octet_length(row_to_json(s)::text)),0)::float8 AS history_bytes FROM selected s
  ) SELECT s.*,b.history_count,b.history_bytes FROM budget b LEFT JOIN selected s
    ON b.history_count<=10000 AND b.history_bytes<=$1 ORDER BY s.created_at,s.id`, [HISTORY_BYTES]);
  const budget = result.rows[0];
  if (!budget || !Number.isSafeInteger(budget.history_count) || budget.history_count < 0 ||
      !Number.isSafeInteger(budget.history_bytes) || budget.history_bytes < 0) {
    throw gatewayError('gateway_archive_history_size_limit');
  }
  if (budget.history_count > 10000) throw gatewayError('gateway_archive_job_capacity');
  if (budget.history_bytes > HISTORY_BYTES) throw gatewayError('gateway_archive_history_size_limit');
  if (!budget.history_count) return [];
  return result.rows.map(({ history_count: _count, history_bytes: _bytes, ...job }) => job);
}
