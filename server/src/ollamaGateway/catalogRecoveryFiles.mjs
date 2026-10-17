/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { archiveDirectory } from './archiveFiles.mjs';
import { managedArchivePath } from './archiveManagedFiles.mjs';
import { catalogInventorySummary } from './catalogRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

/** Version 2 recovery requirements, independently derived again from restored SQL. */
export async function requiredCatalogArchives(client) {
  const result = await client.query(`SELECT id FROM gateway_archive.job WHERE status='verified' AND
    (recovery_protection_id IS NOT NULL OR id IN
      (SELECT id FROM gateway_archive.job WHERE status='verified' ORDER BY created_at DESC,id DESC LIMIT 2))
    ORDER BY id LIMIT 10001`);
  if (result.rowCount > 10000) throw gatewayError('gateway_catalog_size_limit');
  return new Set(result.rows.map(row => row.id));
}

/** Recheck exactly the recorded files. Later valid protection promotion cannot rewrite history. */
export async function checkCatalogInventoryFiles(paths, entries, signal) {
  catalogInventorySummary(entries);
  const archives = await archiveDirectory(paths.archives), receipts = await archiveDirectory(paths.receipts);
  for (const entry of entries) {
    signal?.throwIfAborted();
    const directory = entry.kind === 'receipt' ? receipts : await archiveDirectory(managedArchivePath(archives, entry.id));
    const name = entry.kind === 'receipt' ? `${entry.id}.json` :
      ({ dump: 'gateway.dump', manifest: 'manifest.json', protection: 'protection.json' })[entry.kind];
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- private directory, validated UUIDv7 and fixed allowlisted file kinds.
    const file = await open(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.uid !== process.geteuid() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size !== entry.bytes) {
        throw gatewayError('gateway_catalog_dependency');
      }
      const hash = createHash('sha256'), buffer = Buffer.alloc(65536); let size = 0;
      for (;;) {
        signal?.throwIfAborted();
        const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        size += bytesRead;
        if (size > entry.bytes) throw gatewayError('gateway_catalog_dependency');
        hash.update(buffer.subarray(0, bytesRead));
      }
      if (size !== entry.bytes || hash.digest('hex') !== entry.sha256) throw gatewayError('gateway_catalog_dependency');
    } finally { await file.close(); }
  }
}
