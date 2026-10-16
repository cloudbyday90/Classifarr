/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

/** This dedicated maintenance session must never share the inference session. */
export async function lockArchiveCoordinator(client) {
  const prior = await client.query(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
    AND classid=11435 AND objid=2 AND objsubid=2 AND granted) AS held`);
  if (prior.rows[0].held || !(await client.query('SELECT pg_try_advisory_lock(11435,2) AS acquired')).rows[0].acquired) {
    throw gatewayError('gateway_archive_coordinator_running');
  }
}

export function archiveJobRepository(client) {
  return {
    async list() {
      const result = await client.query(`SELECT id,ledger_id,provider_hash,policy_hash,revision,attempt,status,
        created_at,completed_at,retry_after,manifest_sha256,reason,
        CASE WHEN status IN ('verified','awaiting_verification','retiring') THEN manifest END AS manifest,
        CASE WHEN status IN ('verified','retiring') THEN receipt END AS receipt
        FROM gateway_archive.job ORDER BY created_at,id LIMIT 10001`);
      if (result.rowCount > 10000) throw gatewayError('gateway_archive_job_capacity');
      return result.rows;
    },
    async begin(report, revision, policyHash) {
      return (await client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,revision,policy_hash,attempt,status)
        SELECT $1,$2,$3,$4,COALESCE(max(attempt),0)+1,'exporting' FROM gateway_archive.job
        WHERE ledger_id=$1 AND provider_hash=$2 AND revision=$3 RETURNING *`, [report.ledgerId,report.providerHash,revision,policyHash])).rows[0];
    },
    async published(id, result) {
      const row = await client.query(`UPDATE gateway_archive.job SET status='awaiting_verification',manifest_sha256=$2,manifest=$3
        WHERE id=$1 AND status='exporting' RETURNING id`, [id,result.manifestSha256,result.manifest]);
      if (row.rowCount !== 1) throw gatewayError('gateway_archive_job_fence');
    },
    async verified(id, receipt) {
      const row = await client.query(`UPDATE gateway_archive.job SET status='verified',receipt=$2,completed_at=clock_timestamp()
        WHERE id=$1 AND status='awaiting_verification' AND manifest_sha256=$3 RETURNING id`, [id,receipt,receipt.manifestSha256]);
      if (row.rowCount !== 1) throw gatewayError('gateway_archive_job_fence');
    },
    async failed(id, reason) {
      await client.query(`UPDATE gateway_archive.job SET status='failed',reason=$2,completed_at=clock_timestamp(),
        retry_after=clock_timestamp()+CASE WHEN attempt=1 THEN interval '5 minutes' ELSE interval '30 minutes' END
        WHERE id=$1 AND status IN ('exporting','awaiting_verification')`, [id,reason]);
    },
    async interrupted() {
      await client.query("UPDATE gateway_archive.job SET status='interrupted',reason='export_interrupted' WHERE status='exporting'");
    },
    async retiring(id) {
      const result = await client.query("UPDATE gateway_archive.job SET status='retiring' WHERE id=$1 AND status='verified' RETURNING id", [id]);
      if (result.rowCount !== 1) throw gatewayError('gateway_archive_job_fence');
    },
    async retired(id) {
      await client.query("UPDATE gateway_archive.job SET status='retired' WHERE id=$1 AND status='retiring'", [id]);
    },
  };
}
