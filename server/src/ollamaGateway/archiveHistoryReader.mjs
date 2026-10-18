/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { ARCHIVE_HISTORY_QUERY } from './archiveHistoryQuery.mjs';

// Operational read bound, not a new retention policy or permission to drop history.
// Repeated coordinator reads must fit the deployed 256 MiB process/container.
const HISTORY_BYTES = 8 * 1024 * 1024;

/** Complete ordered metadata only; never aggregate full evidence in the coordinator. */
export async function readArchiveHistory(client) {
  const result = await client.query(ARCHIVE_HISTORY_QUERY, [HISTORY_BYTES]);
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
