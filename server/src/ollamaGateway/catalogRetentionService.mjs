/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { archiveDirectory, readVerifiedGatewayArchive } from './archiveFiles.mjs';
import { managedArchivePath, retireArchiveFiles } from './archiveManagedFiles.mjs';
import { inspectCatalogDependencies } from './catalogDependencies.mjs';
import { validateCatalogRetention } from './catalogRetentionContract.mjs';
import { catalogRetentionRepository } from './catalogRetentionRepository.mjs';
import { withArchiveMaintenance } from './archiveMaintenanceLock.mjs';
import { gatewayError } from './errors.mjs';

async function locations(paths) {
  if (!paths || Object.keys(paths).sort().join(',') !== 'archives,catalogs,receipts') throw gatewayError('gateway_catalog_contract');
  const values = await Promise.all([paths.catalogs, paths.archives, paths.receipts].map(archiveDirectory));
  if (new Set(values).size !== 3) throw gatewayError('gateway_catalog_contract');
  return { catalogs: values[0], archives: values[1], receipts: values[2] };
}

async function inspectDependencies(client, paths, signal, collect = null, selected = null) {
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='4s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='75s'");
    const summary = await inspectCatalogDependencies(client, paths.archives, paths.receipts, signal, collect, selected);
    signal?.throwIfAborted(); await client.query('COMMIT'); return summary;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

async function checkSet(client, repository, paths, root, signal) {
  const entries = await repository.entries(root.id);
  validateCatalogRetention(root.manifest, root.manifest_sha256, root.verification, entries);
  const checked = await readVerifiedGatewayArchive(managedArchivePath(paths.catalogs, root.archive_id), signal);
  if (checked.manifestSha256 !== root.manifest_sha256 || !isDeepStrictEqual(checked.manifest, root.manifest)) {
    throw gatewayError('gateway_catalog_registration_invalid');
  }
  const summary = await inspectDependencies(client, paths, signal, null, new Set(entries.map(entry => entry.id)));
  if (!isDeepStrictEqual(summary, root.manifest.catalog.dependencies)) throw gatewayError('gateway_catalog_dependency');
}

/** Internal, optional retention seam. No timer, endpoint, capture admission or provider call. */
export function catalogRetentionService(client) {
  const repository = catalogRetentionRepository(client);
  function run(paths, signal, action) {
    signal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(120000)]);
    return withArchiveMaintenance(client, async () => {
      signal.throwIfAborted();
      await client.query('SELECT gateway_catalog.require_lock()');
      return action(await locations(paths), signal);
    });
  }
  return {
    retain(paths, archiveId, verification, signal) {
      return run(paths, signal, async (checkedPaths, bounded) => {
        const checked = await readVerifiedGatewayArchive(managedArchivePath(checkedPaths.catalogs, archiveId), bounded);
        const entries = [];
        const summary = await inspectDependencies(client, checkedPaths, bounded, entry => entries.push(entry));
        if (!isDeepStrictEqual(summary, checked.manifest.catalog?.dependencies)) throw gatewayError('gateway_catalog_dependency');
        bounded.throwIfAborted();
        const root = await repository.register(checked.manifest, checked.manifestSha256, verification, entries, bounded);
        return { state: 'retained', snapshotId: root.id, archiveId: root.archive_id, purgeAuthorized: false };
      });
    },
    rotate(paths, signal) {
      return run(paths, signal, async (checkedPaths, bounded) => {
        const roots = await repository.list();
        const prior = roots.find(root => root.status === 'retiring') ?? (roots.length === 3 ? roots[0] : null);
        if (!prior) return { state: 'unchanged', purgeAuthorized: false };
        const remaining = roots.filter(root => root.id !== prior.id && root.status === 'retained' &&
          root.ledger_id === prior.ledger_id && root.provider_hash === prior.provider_hash && root.policy_hash === prior.policy_hash);
        if (remaining.length !== 2) throw gatewayError('gateway_catalog_rotation_blocked');
        for (const root of remaining) await checkSet(client, repository, checkedPaths, root, bounded);
        if (prior.status !== 'retiring') {
          await checkSet(client, repository, checkedPaths, prior, bounded);
          bounded.throwIfAborted(); await repository.transition(prior.id, 'retiring');
        }
        // Pins remain through partial unlink and until the final durable state change.
        await retireArchiveFiles(checkedPaths.catalogs, { id: prior.archive_id, status: 'retiring',
          manifest_sha256: prior.manifest_sha256, manifest: prior.manifest }, bounded);
        bounded.throwIfAborted(); await repository.transition(prior.id, 'retired');
        return { state: 'retired', snapshotId: prior.id, archiveId: prior.archive_id, purgeAuthorized: false };
      });
    },
  };
}
