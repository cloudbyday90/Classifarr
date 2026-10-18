/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { catalogAdmissionRecord, validateCatalogAdmission } from './catalogAdmissionContract.mjs';
import { gatewayError } from './errors.mjs';

export async function requireCatalogCaptureFormat(client) {
  try {
    if ((await client.query('SELECT gateway_catalog.capture_format() AS version')).rows[0]?.version !== 3) throw new Error();
  } catch { throw gatewayError('gateway_catalog_format_unavailable'); }
}

export async function readCatalogAdmission(client, manifest) {
  await client.query('SELECT gateway_catalog.require_lock()');
  await client.query("SET timezone='UTC'; SET datestyle='ISO, YMD'");
  const { rows } = await client.query('SELECT to_jsonb(j)::text AS row FROM gateway_catalog.job j WHERE id=$1', [manifest.archiveId]);
  if (rows.length !== 1) throw gatewayError('gateway_catalog_job_fence');
  const record = catalogAdmissionRecord(rows[0].row); validateCatalogAdmission(record, manifest); return record;
}

/** Independently reconstruct the admitted budget at its recorded time, not today's clock. */
export async function checkCatalogAdmissionHistory(client, manifest) {
  const row = validateCatalogAdmission(manifest.catalog.admission, manifest);
  const { valid } = (await client.query(`SELECT greatest(count(*)::int,coalesce(max(attempt),0))+1=$2::int
    AND greatest(count(*)::int,coalesce(max(attempt),0))<3
    AND NOT coalesce(bool_or(retry_after>$3::timestamptz),false) AS valid FROM (
      SELECT attempt,retry_after FROM gateway_archive.job WHERE revision=ANY($1::text[])
      UNION ALL SELECT attempt,retry_after FROM gateway_catalog.job WHERE compatible_revisions && $1::text[]
    ) prior`, [row.compatible_revisions, row.attempt, row.created_at])).rows[0];
  if (!valid) throw gatewayError('gateway_catalog_budget_blocked');
}
