/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

/** Validate logical links not covered by the packaged foreign keys. Read-only. */
export async function checkCatalogRelationships(client, archiveId, report) {
  const { valid } = (await client.query(`SELECT
    (SELECT count(*)=1 FROM gateway_archive.job WHERE id=$1 AND status='exporting' AND manifest IS NULL
      AND receipt IS NULL AND completed_at IS NULL AND recovery_protection_id IS NULL)
    AND NOT EXISTS(SELECT 1 FROM gateway_archive.job WHERE status IN ('exporting','awaiting_verification','interrupted','retiring') AND id<>$1)
    AND NOT EXISTS(SELECT 1 FROM gateway_archive.job WHERE ledger_id IS DISTINCT FROM $2::uuid OR provider_hash IS DISTINCT FROM $3)
    AND NOT EXISTS(SELECT 1 FROM gateway_archive.protection p
      LEFT JOIN gateway_archive.job a ON a.id=p.first_archive_id LEFT JOIN gateway_archive.job b ON b.id=p.second_archive_id
      WHERE p.ledger_id IS DISTINCT FROM $2::uuid OR p.provider_hash IS DISTINCT FROM $3
        OR a.recovery_protection_id IS DISTINCT FROM p.id OR b.recovery_protection_id IS DISTINCT FROM p.id
        OR a.status IS DISTINCT FROM 'verified' OR b.status IS DISTINCT FROM 'verified'
        OR a.policy_hash IS DISTINCT FROM b.policy_hash
        OR a.manifest_sha256 IS DISTINCT FROM p.first_manifest_sha256 OR b.manifest_sha256 IS DISTINCT FROM p.second_manifest_sha256
        OR a.manifest->'retention'->'entries' IS DISTINCT FROM b.manifest->'retention'->'entries')
    AND NOT EXISTS(SELECT 1 FROM gateway_archive.job j LEFT JOIN gateway_archive.protection p ON p.id=j.recovery_protection_id
      WHERE j.recovery_protection_id IS NOT NULL AND (p.id IS NULL OR j.id NOT IN (p.first_archive_id,p.second_archive_id)))
    AND NOT EXISTS(SELECT 1 FROM gateway_cleanup.operation o LEFT JOIN gateway_archive.protection p ON p.id=o.protection_id
      LEFT JOIN gateway_archive.job j ON j.id=p.first_archive_id
      WHERE p.id IS NULL OR p.ready_at IS NULL OR o.ledger_id IS DISTINCT FROM p.ledger_id
        OR o.provider_hash IS DISTINCT FROM p.provider_hash OR o.candidates_sha256 IS DISTINCT FROM p.candidates_sha256
        OR o.status='completed' AND (o.deleted_bindings IS DISTINCT FROM jsonb_array_length(j.manifest->'retention'->'entries')
          OR o.deleted_completions IS DISTINCT FROM o.deleted_bindings OR o.deleted_peers>o.deleted_bindings))
    AS valid`, [archiveId, report.ledgerId, report.providerHash])).rows[0];
  if (!valid) throw gatewayError('gateway_catalog_relationships');
}
