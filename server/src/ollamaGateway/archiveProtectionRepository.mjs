/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

export function archiveProtectionRepository(client) {
  return {
    async assertSchema() {
      const result = await client.query(`SELECT count(*)::int AS n FROM pg_trigger
        WHERE tgrelid IN (to_regclass('gateway_archive.job'),to_regclass('gateway_archive.protection'))
        AND tgname IN ('archive_protection_guard','archive_protection_truncate_guard','archive_protection_fence',
          'archive_job_protection_guard','archive_job_truncate_guard') AND tgenabled IN ('O','A')`);
      if (result.rows[0].n !== 5) throw gatewayError('gateway_archive_protection_schema_required');
    },
    async protect(pair, candidatesSha256) {
      const [first, second] = [...pair].sort((a,b) => a.id.localeCompare(b.id));
      const result = await client.query(`INSERT INTO gateway_archive.protection
        (ledger_id,provider_hash,candidates_sha256,first_archive_id,second_archive_id,first_manifest_sha256,second_manifest_sha256)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [first.ledger_id,first.provider_hash,candidatesSha256,first.id,second.id,first.manifest_sha256,second.manifest_sha256]);
      return result.rows[0];
    },
    async ready(id) {
      const result = await client.query(`UPDATE gateway_archive.protection SET ready_at=clock_timestamp()
        WHERE id=$1 AND ready_at IS NULL RETURNING id`,[id]);
      if (result.rowCount !== 1) throw gatewayError('gateway_archive_protection_fence');
    },
  };
}
