/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateCatalogRetention } from './catalogRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

export async function hasCatalogRetention(client) {
  const { installed } = (await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gateway_catalog') AS installed")).rows[0];
  if (!installed) return false;
  await client.query('SELECT gateway_catalog.require_lock()');
  return (await client.query("SELECT EXISTS(SELECT 1 FROM gateway_catalog.snapshot WHERE status<>'retired') AS active")).rows[0].active;
}

/** Missing registry is the legacy deployment. Partial installation/permission failures are not. */
export async function assertArchiveNotCatalogPinned(client, id) {
  const { installed } = (await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gateway_catalog') AS installed")).rows[0];
  if (!installed) return;
  await client.query('SELECT gateway_catalog.require_lock()');
  if ((await client.query(`SELECT EXISTS(SELECT 1 FROM gateway_catalog.dependency d
    JOIN gateway_catalog.snapshot s ON s.id=d.snapshot_id WHERE d.archive_id=$1 AND s.status<>'retired') AS pinned`, [id])).rows[0].pinned) {
    throw gatewayError('gateway_catalog_dependency');
  }
}

export function catalogRetentionRepository(client) {
  return {
    async register(manifest, manifestSha256, verification, entries, signal) {
      validateCatalogRetention(manifest, manifestSha256, verification, entries);
      signal?.throwIfAborted();
      await client.query('BEGIN');
      try {
        await client.query("SET LOCAL statement_timeout='4s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='15s'");
        await client.query('SELECT gateway_catalog.require_lock()');
        const prior = (await client.query('SELECT * FROM gateway_catalog.snapshot WHERE archive_id=$1', [manifest.archiveId])).rows[0];
        if (prior) {
          if (prior.manifest_sha256 !== manifestSha256 || prior.status !== 'retained') throw gatewayError('gateway_catalog_registration_invalid');
          await client.query('COMMIT'); return prior;
        }
        const row = (await client.query(`INSERT INTO gateway_catalog.snapshot(archive_id,ledger_id,provider_hash,policy_hash,
          manifest_sha256,manifest,verification,dependency_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [manifest.archiveId, manifest.report.ledgerId, manifest.report.providerHash, manifest.policyHash,
          manifestSha256, manifest, verification, entries.length])).rows[0];
        // A bounded batch avoids one giant SQL statement/JSON document.
        for (let offset = 0; offset < entries.length; offset += 128) {
          signal?.throwIfAborted();
          const batch = entries.slice(offset, offset + 128);
          await client.query(`INSERT INTO gateway_catalog.dependency(snapshot_id,archive_id,kind,bytes,sha256)
            SELECT $1,x.id,x.kind,x.bytes,x.sha256 FROM jsonb_to_recordset($2::jsonb) AS x(id uuid,kind text,bytes bigint,sha256 text)`,
          [row.id, JSON.stringify(batch)]);
        }
        signal?.throwIfAborted(); await client.query('COMMIT'); return row;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    },
    async list() {
      const result = await client.query(`SELECT * FROM gateway_catalog.snapshot WHERE status<>'retired' ORDER BY created_at,id LIMIT 4`);
      if (result.rowCount > 3) throw gatewayError('gateway_catalog_size_limit');
      return result.rows;
    },
    async entries(id) {
      const result = await client.query(`SELECT archive_id AS id,kind,bytes::float8 AS bytes,sha256 FROM gateway_catalog.dependency
        WHERE snapshot_id=$1 ORDER BY archive_id,CASE kind WHEN 'dump' THEN 0 WHEN 'manifest' THEN 1 WHEN 'receipt' THEN 2 ELSE 3 END LIMIT 40001`, [id]);
      if (result.rowCount > 40000) throw gatewayError('gateway_catalog_size_limit');
      return result.rows;
    },
    async transition(id, status) {
      if (!['retiring', 'retired'].includes(status)) throw gatewayError('gateway_catalog_rotation_blocked');
      const result = await client.query(`UPDATE gateway_catalog.snapshot SET status=$2 WHERE id=$1 AND status=$3 RETURNING id`,
        [id, status, status === 'retiring' ? 'retained' : 'retiring']);
      if (result.rowCount !== 1) throw gatewayError('gateway_catalog_rotation_blocked');
    },
  };
}
