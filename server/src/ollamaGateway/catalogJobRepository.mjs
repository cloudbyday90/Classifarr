/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { validateArchiveManifest } from './archiveContract.mjs';

export function catalogJobRepository(client) {
  const update = async (query, values) => {
    if ((await client.query(query, values)).rowCount !== 1) throw gatewayError('gateway_catalog_job_fence');
  };
  return {
    async list() {
      const result = await client.query(`SELECT id,ledger_id,provider_hash,policy_hash,revision,compatible_revisions,semantic_sha256,
        attempt,status,created_at,completed_at,retry_after,manifest_sha256,reason,
        CASE WHEN status='awaiting_verification' THEN manifest END AS manifest
        FROM gateway_catalog.job ORDER BY created_at,id LIMIT 10001`);
      if (result.rowCount > 10000) throw gatewayError('gateway_catalog_size_limit');
      return result.rows;
    },
    async begin(report, revision, policyHash, semantic, compatibleRevisions) {
      const aliases = [...new Set([revision, ...compatibleRevisions])];
      if (aliases.length > 128) throw gatewayError('gateway_catalog_size_limit');
      return (await client.query(`INSERT INTO gateway_catalog.job(ledger_id,provider_hash,policy_hash,revision,compatible_revisions,semantic_sha256,attempt,status)
        SELECT $1,$2,$3,$4,$5,$6,greatest(count(*)::int,coalesce(max(attempt),0))+1,'exporting' FROM (
          SELECT attempt FROM gateway_archive.job WHERE revision=ANY($5::text[])
          UNION ALL SELECT attempt FROM gateway_catalog.job WHERE compatible_revisions && $5::text[]
        ) prior RETURNING *`, [report.ledgerId, report.providerHash, policyHash, revision, aliases, semantic])).rows[0];
    },
    published: (id, result) => {
      validateArchiveManifest(result.manifest);
      return update(`UPDATE gateway_catalog.job SET status='awaiting_verification',manifest=$2,manifest_sha256=$3
        WHERE id=$1 AND status='exporting' RETURNING id`, [id, result.manifest, result.manifestSha256]);
    },
    verified: (id, receipt) => update(`UPDATE gateway_catalog.job SET status='verified',receipt=$2
      WHERE id=$1 AND status='awaiting_verification' RETURNING id`, [id, receipt]),
    failed: (id, reason) => update(`UPDATE gateway_catalog.job SET status='failed',reason=$2
      WHERE id=$1 AND status IN ('exporting','awaiting_verification') RETURNING id`, [id, reason]),
    interrupted: () => client.query("UPDATE gateway_catalog.job SET status='interrupted',reason='export_interrupted' WHERE status='exporting'"),
  };
}
