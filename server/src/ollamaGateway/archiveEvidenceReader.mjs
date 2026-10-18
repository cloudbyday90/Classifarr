/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { ARCHIVE_HISTORY_FIELDS } from './archiveHistoryProjection.mjs';
import { archiveUuid } from './archiveContract.mjs';
import { gatewayError } from './errors.mjs';

/** Same maintenance session; no cursor/transaction survives an owned state transition. */
export async function readArchiveEvidence(client, summary, signal) {
  signal?.throwIfAborted();
  if (!archiveUuid(summary?.id)) throw gatewayError('gateway_archive_job_fence');
  const result = await client.query(`WITH evidence AS MATERIALIZED (
    SELECT ${ARCHIVE_HISTORY_FIELDS},
      CASE WHEN j.status IN ('verified','awaiting_verification','retiring') THEN j.manifest END AS manifest,
      CASE WHEN j.status IN ('verified','retiring') THEN j.receipt END AS receipt
    FROM gateway_archive.job j LEFT JOIN gateway_archive.protection p ON p.id=j.recovery_protection_id WHERE j.id=$1
  ), budget AS MATERIALIZED (
    SELECT octet_length(row_to_json(e)::text) AS evidence_bytes FROM evidence e
  ) SELECT e.*,b.evidence_bytes FROM budget b LEFT JOIN evidence e ON b.evidence_bytes<=131072`, [summary.id]);
  signal?.throwIfAborted();
  if (result.rows.length !== 1) throw gatewayError('gateway_archive_job_fence');
  const { evidence_bytes, manifest, receipt, ...observed } = result.rows[0];
  if (!Number.isSafeInteger(evidence_bytes) || evidence_bytes < 0 || evidence_bytes > 131072) {
    throw gatewayError('gateway_archive_history_size_limit');
  }
  if (!isDeepStrictEqual(observed, summary)) throw gatewayError('gateway_archive_job_fence');
  return { ...observed, manifest, receipt };
}
