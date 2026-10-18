/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withOnlineArchiveSnapshot, assertArchiveSnapshot } from './onlineArchiveSnapshot.mjs';
import { captureArchiveContent } from './archiveContent.mjs';
import { captureRetentionInventory } from './archiveRetentionQueries.mjs';
import { createArchiveDirectory, finishArchive } from './archiveFiles.mjs';
import { dumpGatewayArchive } from './archiveDump.mjs';
import { gatewayError } from './errors.mjs';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { checkCatalogReader } from './catalogReader.mjs';
import { captureCatalogContent } from './catalogContent.mjs';
import { checkCatalogRelationships } from './catalogRelationships.mjs';
import { inspectCatalogDependencies } from './catalogDependencies.mjs';
import { withArchiveMaintenance } from './archiveMaintenanceLock.mjs';
import { archiveStorageAvailable } from './archiveManagedFiles.mjs';

export { withOnlineArchiveSnapshot };

// Internal opt-in seam for isolated catalog verification, not a live worker setting.
export async function createOnlineArchive(client, configuration, parent, job, predecessors, signal, catalog = null, context = null) {
  if (context) {
    if (catalog) throw gatewayError('gateway_catalog_contract');
    const manifest = await captureOnlineManifest(client, configuration, parent, job, predecessors, signal, null, context);
    return { ...await finishArchive(join(parent, `gateway-archive-${job.id}`), manifest), manifest };
  }
  if (!catalog) return captureOnlineArchive(client, configuration, parent, job, predecessors, signal, null);
  if (!['receipts', 'archives,receipts'].includes(Object.keys(catalog).sort().join(',')) || typeof catalog.receipts !== 'string' ||
      (Object.hasOwn(catalog, 'archives') && typeof catalog.archives !== 'string')) throw gatewayError('gateway_catalog_contract');
  signal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(120000)]);
  await checkCatalogReader(client);
  const identity = (await client.query('SELECT current_user AS role,current_database() AS database')).rows[0];
  if (identity.role !== configuration.database?.user || identity.database !== configuration.database?.database) {
    throw gatewayError('gateway_catalog_reader_unsafe');
  }
  return withArchiveMaintenance(client, () => captureOnlineArchive(client, configuration, parent, job, predecessors, signal, catalog));
}

async function captureOnlineArchive(client, configuration, parent, job, predecessors, signal, catalog) {
  const manifest = await withOnlineArchiveSnapshot(client, configuration, context =>
    captureOnlineManifest(client, configuration, parent, job, predecessors, signal, catalog, context), signal);
  return { ...await finishArchive(join(parent, `gateway-archive-${job.id}`), manifest), manifest };
}

async function captureOnlineManifest(client, configuration, parent, job, predecessors, signal, catalog, context) {
  assertArchiveSnapshot(client, context);
  const { report, revision } = context;
  if (report.ledgerId !== job.ledger_id || revision !== job.revision) throw gatewayError('gateway_archive_source_changed');
  const snapshot = (await client.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  const budget = { bytes: 0, ...(catalog ? { rowLimit: 131072 } : {}) };
  const content = await captureArchiveContent(client, signal, null, budget);
  const retention = await captureRetentionInventory(client, report);
  let capturedCatalog;
  if (catalog) {
    await checkCatalogRelationships(client, job.id, report);
    const tables = await captureCatalogContent(client, signal, budget);
    const jobs = (await client.query('SELECT id,recovery_protection_id FROM gateway_archive.job ORDER BY id LIMIT 10001')).rows;
    const dependencies = catalog.archives ?? parent;
    if (jobs.length > 10000 || !await archiveStorageAvailable(parent, catalog.receipts, jobs, dependencies === parent ? [] : [dependencies])) {
      throw gatewayError('gateway_archive_storage_blocked');
    }
    capturedCatalog = { version: 1, tables, dependencies: await inspectCatalogDependencies(client, dependencies, catalog.receipts, signal) };
  }
  signal?.throwIfAborted();
  const directory = await createArchiveDirectory(parent, job.id);
  const dump = await dumpGatewayArchive(configuration, snapshot, directory, signal, Boolean(catalog));
  if (catalog && !isDeepStrictEqual(capturedCatalog.dependencies, await inspectCatalogDependencies(client, catalog.archives ?? parent, catalog.receipts, signal))) {
    throw gatewayError('gateway_catalog_dependency');
  }
  return { version: catalog ? 5 : 4, schemaVersion: 7, archiveId: job.id, report, revision, policyHash: job.policy_hash,
    content, predecessors, retention, dump, ...(catalog ? { catalog: capturedCatalog } : {}) };
}
