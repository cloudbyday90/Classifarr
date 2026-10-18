/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { assertArchiveSnapshot } from './onlineArchiveSnapshot.mjs';
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
import { readCatalogAdmission, checkCatalogAdmissionHistory } from './catalogAdmission.mjs';
import { gatewayError } from './errors.mjs';

/** The frozen dump predates its separately preserved, independently fenced admission. */
export async function captureFrozenCatalog({ source, maintenance, configuration, paths, job, signal, context }) {
  assertArchiveSnapshot(source, context); await checkCatalogReader(source, 3);
  const identity = (await source.query('SELECT current_user AS role,current_database() AS database')).rows[0];
  if (identity.role !== configuration.database.user || identity.database !== configuration.database.database) throw gatewayError('gateway_catalog_reader_unsafe');
  const { report, revision } = context;
  if (report.ledgerId !== job.ledger_id || revision !== job.revision) throw gatewayError('gateway_archive_source_changed');
  const envelope = { archiveId: job.id, report, revision, policyHash: job.policy_hash, catalog: { semanticSha256: job.semantic_sha256 } };
  const admission = await readCatalogAdmission(maintenance, envelope);
  await checkCatalogRelationships(source, job.id, report, 3);
  await checkCatalogAdmissionHistory(source, { ...envelope, catalog: { ...envelope.catalog, admission } });
  const snapshot = (await source.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  const budget = { bytes: Buffer.byteLength(admission.row), rowLimit: 131072 };
  const content = await captureArchiveContent(source, signal, null, budget);
  const retention = await captureRetentionInventory(source, report);
  const tables = await captureCatalogContent(source, signal, budget, 3);
  if (catalogSemanticRevision(tables) !== job.semantic_sha256) throw gatewayError('gateway_archive_source_changed');
  const jobs = (await source.query(`SELECT id,recovery_protection_id FROM gateway_archive.job
    UNION ALL SELECT id,NULL::uuid FROM gateway_catalog.job LIMIT 20001`)).rows;
  if (jobs.length >= 20000 || !await archiveStorageAvailable(paths.catalogs, paths.receipts, [...jobs, { id: job.id }], [paths.archives])) {
    throw gatewayError('gateway_archive_storage_blocked');
  }
  const selected = await requiredCatalogArchives(source);
  const dependencies = await inspectCatalogDependencies(source, paths.archives, paths.receipts, signal, null, selected);
  signal?.throwIfAborted();
  const directory = await createArchiveDirectory(paths.catalogs, job.id);
  const dump = await dumpGatewayArchive(configuration, snapshot, directory, signal, 3);
  if (!isDeepStrictEqual(dependencies, await inspectCatalogDependencies(source, paths.archives, paths.receipts, signal, null, selected)) ||
      !isDeepStrictEqual(admission, await readCatalogAdmission(maintenance, envelope))) throw gatewayError('gateway_catalog_job_fence');
  const manifest = { version: 7, schemaVersion: 7, archiveId: job.id, report, revision, policyHash: job.policy_hash,
    content, predecessors: [], retention, dump, catalog: { version: 3, tables, semanticSha256: job.semantic_sha256, dependencies, admission } };
  signal?.throwIfAborted(); return { ...await finishArchive(directory, manifest), manifest };
}
