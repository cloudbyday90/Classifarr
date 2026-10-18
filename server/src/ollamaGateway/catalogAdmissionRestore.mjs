/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { captureCatalogContent } from './catalogContent.mjs';
import { catalogSemanticRevision } from './catalogSchedule.mjs';
import { checkCatalogRelationships } from './catalogRelationships.mjs';
import { validateCatalogAdmission } from './catalogAdmissionContract.mjs';
import { gatewayError } from './errors.mjs';
import { checkCatalogAdmissionHistory } from './catalogAdmission.mjs';

/** Only the private verifier calls this, before sealing its packaged restore schema. */
export async function restoreCatalogAdmission(owner, restricted, manifest, budget, signal) {
  validateCatalogAdmission(manifest.catalog.admission, manifest);
  budget.bytes += Buffer.byteLength(manifest.catalog.admission.row);
  await owner.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
  try {
    const tables = await captureCatalogContent(owner, signal, budget, 3);
    if (!isDeepStrictEqual(tables, manifest.catalog.tables) || catalogSemanticRevision(tables) !== manifest.catalog.semanticSha256) {
      throw gatewayError('gateway_archive_restore_mismatch');
    }
    // A duplicate current row or another pending admission is not an insert opportunity.
    await checkCatalogRelationships(owner, manifest.archiveId, manifest.report, 3);
    await checkCatalogAdmissionHistory(owner, manifest);
    signal?.throwIfAborted(); await owner.query('COMMIT');
  } catch (error) { await owner.query('ROLLBACK'); throw error; }
  try {
    await restricted.connect();
    await restricted.query("BEGIN; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
    signal?.throwIfAborted();
    const { rows } = await restricted.query(`INSERT INTO gateway_catalog.job AS j
      SELECT (jsonb_populate_record(NULL::gateway_catalog.job,$1::jsonb)).* RETURNING to_jsonb(j)::text AS row`, [manifest.catalog.admission.row]);
    if (rows.length !== 1 || rows[0].row !== manifest.catalog.admission.row) throw gatewayError('gateway_archive_restore_mismatch');
    signal?.throwIfAborted(); await restricted.query('COMMIT');
  } catch (error) {
    try { await restricted.query('ROLLBACK'); } catch { /* The private login is discarded. */ }
    throw error;
  } finally { await restricted.end(); }
}

export async function assertRestoredCatalogAdmission(client, manifest) {
  const { rows } = await client.query('SELECT to_jsonb(j)::text AS row FROM gateway_catalog.job j WHERE id=$1', [manifest.archiveId]);
  if (rows.length !== 1 || rows[0].row !== manifest.catalog.admission.row) throw gatewayError('gateway_archive_restore_mismatch');
}
