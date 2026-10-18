/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { archiveUuid, archiveHash } from './archiveRetentionContract.mjs';
import { validateArchiveManifest } from './archiveContract.mjs';
import { gatewayError } from './errors.mjs';

const kinds = ['dump', 'manifest', 'receipt', 'protection'];

/** Fixed-order, bounded index; matches the independently derived restored-SQL inventory. */
export function catalogInventorySummary(entries) {
  if (!Array.isArray(entries) || entries.length > 40000) throw gatewayError('gateway_catalog_size_limit');
  let bytes = 0, previous = null;
  const digest = createHash('sha256');
  for (const entry of entries) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'bytes,id,kind,sha256' || !archiveUuid(entry.id) ||
        !kinds.includes(entry.kind) || !archiveHash(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 ||
        entry.bytes > (entry.kind === 'dump' ? 268435456 : entry.kind === 'manifest' ? 65536 : 4096)) {
      throw gatewayError('gateway_catalog_dependency');
    }
    const order = `${entry.id}:${kinds.indexOf(entry.kind)}`;
    if (previous !== null && order <= previous) throw gatewayError('gateway_catalog_dependency');
    previous = order; bytes += entry.bytes;
    if (bytes > 1073741824) throw gatewayError('gateway_catalog_size_limit');
    digest.update(JSON.stringify({ id: entry.id, kind: entry.kind, bytes: entry.bytes, sha256: entry.sha256 })).update('\n');
  }
  // Every referenced archive requires the dump, manifest and verifier receipt together.
  for (let index = 0; index < entries.length;) {
    const id = entries[index].id;
    for (const kind of kinds.slice(0, 3)) {
      if (entries[index]?.id !== id || entries[index]?.kind !== kind) throw gatewayError('gateway_catalog_dependency');
      index++;
    }
    if (entries[index]?.id === id && entries[index].kind === 'protection') index++;
  }
  return { count: entries.length, bytes, sha256: digest.digest('hex') };
}

export function validateCatalogRetention(manifest, manifestSha256, verification, entries) {
  validateArchiveManifest(manifest);
  if (![5, 6, 7].includes(manifest.version) || !archiveHash(manifestSha256) ||
      !isDeepStrictEqual(verification, { kind: 'catalog_verification', version: 1, archiveId: manifest.archiveId,
        manifestSha256, dumpSha256: manifest.dump.sha256, rowsRestored: true, dependenciesAvailable: true,
        runtimeEnabled: false, purgeAuthorized: false }) ||
      !isDeepStrictEqual(manifest.catalog.dependencies, catalogInventorySummary(entries))) {
    throw gatewayError('gateway_catalog_registration_invalid');
  }
  return manifest;
}
