/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withOnlineArchiveSnapshot } from './onlineArchive.mjs';
import { checkCatalogReader } from './catalogReader.mjs';
import { captureArchiveContent } from './archiveContent.mjs';
import { captureCatalogContent } from './catalogContent.mjs';
import { catalogSemanticRevision } from './catalogSchedule.mjs';
import { captureRetentionInventory } from './archiveRetentionQueries.mjs';
import { requiredCatalogArchives } from './catalogRecoveryFiles.mjs';
import { inspectCatalogDependencies } from './catalogDependencies.mjs';
import { checkCatalogRelationships } from './catalogRelationships.mjs';
import { createArchiveDirectory, finishArchive } from './archiveFiles.mjs';
import { archiveStorageAvailable } from './archiveManagedFiles.mjs';
import { dumpGatewayArchive } from './archiveDump.mjs';
import { gatewayError } from './errors.mjs';
import { isDeepStrictEqual } from 'node:util';
import { captureFrozenCatalog } from './catalogFrozenCapture.mjs';

/** The maintenance connection owns exclusion; the independent source stays SELECT-only. */
export async function captureScheduledCatalog({ source, maintenance, configuration, paths, job, signal, context = null }) {
  if (context) return captureFrozenCatalog({ source, maintenance, configuration, paths, job, signal, context });
  await maintenance.query('SELECT gateway_catalog.require_lock()');
  await checkCatalogReader(source, 2);
  const identity = (await source.query('SELECT current_user AS role,current_database() AS database')).rows[0];
  if (identity.role !== configuration.database.user || identity.database !== configuration.database.database) throw gatewayError('gateway_catalog_reader_unsafe');
  let directory;
  const manifest = await withOnlineArchiveSnapshot(source, configuration, async ({ report, revision }) => {
    if (report.ledgerId !== job.ledger_id || revision !== job.revision) throw gatewayError('gateway_archive_source_changed');
    await checkCatalogRelationships(source, job.id, report, 2);
    const snapshot = (await source.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
    const budget = { bytes: 0, rowLimit: 131072 };
    const content = await captureArchiveContent(source, signal, null, budget);
    const retention = await captureRetentionInventory(source, report);
    const tables = await captureCatalogContent(source, signal, budget, 2);
    if (catalogSemanticRevision(tables) !== job.semantic_sha256) throw gatewayError('gateway_archive_source_changed');
    const jobs = (await source.query(`SELECT id,recovery_protection_id FROM gateway_archive.job
      UNION ALL SELECT id,NULL::uuid FROM gateway_catalog.job LIMIT 20001`)).rows;
    if (jobs.length > 20000 || !await archiveStorageAvailable(paths.catalogs, paths.receipts, jobs, [paths.archives])) throw gatewayError('gateway_archive_storage_blocked');
    const selected = await requiredCatalogArchives(source);
    const dependencies = await inspectCatalogDependencies(source, paths.archives, paths.receipts, signal, null, selected);
    directory = await createArchiveDirectory(paths.catalogs, job.id);
    const dump = await dumpGatewayArchive(configuration, snapshot, directory, signal, 2);
    if (!isDeepStrictEqual(dependencies, await inspectCatalogDependencies(source, paths.archives, paths.receipts, signal, null, selected))) throw gatewayError('gateway_catalog_dependency');
    return { version: 6, schemaVersion: 7, archiveId: job.id, report, revision, policyHash: job.policy_hash,
      content, predecessors: [], retention, dump, catalog: { version: 2, tables, semanticSha256: job.semantic_sha256, dependencies } };
  }, signal);
  signal?.throwIfAborted();
  return { ...await finishArchive(directory, manifest), manifest };
}
