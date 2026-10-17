/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { archiveDirectory } from './archiveFiles.mjs';
import { checkManagedArchive, managedArchivePath } from './archiveManagedFiles.mjs';
import { visitCatalogRows } from './catalogContent.mjs';
import { candidateBatchSha256 } from './archiveProtectionPolicy.mjs';
import { gatewayError } from './errors.mjs';

async function evidence(directory, name, expected, limit = 4096) {
  let file;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- private checked directory; fixed marker or database UUIDv7 receipt name, never archived paths.
    file = await open(join(await archiveDirectory(directory), name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.geteuid() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size > limit) throw new Error();
    const bytes = Buffer.alloc(limit + 1); let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await file.read(bytes, length, bytes.length - length, null);
      if (!bytesRead) break; length += bytesRead;
    }
    const data = bytes.subarray(0, length);
    if (length > limit || !isDeepStrictEqual(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)), expected)) throw new Error();
    return { bytes: length, sha256: createHash('sha256').update(data).digest('hex') };
  } catch { throw gatewayError('gateway_catalog_dependency'); }
  finally { await file?.close(); }
}

/** Derive the inventory from the same SQL snapshot; never repair publication or copy dependencies recursively. */
export async function inspectCatalogDependencies(client, archives, receipts, signal, collect = null, selected = null) {
  archives = await archiveDirectory(archives); receipts = await archiveDirectory(receipts);
  const digest = createHash('sha256'); let count = 0, bytes = 0;
  function record(id, kind, item) {
    bytes += item.bytes;
    if (++count > 40000 || bytes > 1073741824) throw gatewayError('gateway_catalog_size_limit');
    digest.update(JSON.stringify({ id, kind, ...item })).update('\n');
    collect?.({ id, kind, ...item });
  }
  await visitCatalogRows(client, 0, async row => {
    const job = JSON.parse(row.row);
    if (selected && !selected.has(job.id)) return;
    // Unfinished/failed jobs are historical records, not usable restore evidence.
    // The relationship check excludes other active publication/retirement states.
    if (job.status !== 'verified') return;
    if (job.manifest?.report?.ledgerId !== job.ledger_id || job.manifest?.report?.providerHash !== job.provider_hash ||
        job.manifest?.revision !== job.revision || job.manifest?.policyHash !== job.policy_hash) throw gatewayError('gateway_catalog_dependency');
    if (bytes + (job.manifest?.dump?.bytes ?? 1073741825) > 1073741824) throw gatewayError('gateway_catalog_size_limit');
    const checked = await checkManagedArchive(archives, job, signal);
    if (!job.receipt?.verified) throw gatewayError('gateway_catalog_dependency');
    record(job.id, 'dump', { bytes: checked.manifest.dump.bytes, sha256: checked.manifest.dump.sha256 });
    const marker = await evidence(managedArchivePath(archives, job.id), 'manifest.json', checked.manifest, 65536);
    if (marker.sha256 !== checked.manifestSha256) throw gatewayError('gateway_catalog_dependency');
    record(job.id, 'manifest', marker);
    record(job.id, 'receipt', await evidence(receipts, `${job.id}.json`, job.receipt));
    if (job.recovery_protection_id) {
      const hold = (await client.query('SELECT to_jsonb(p)::text AS row FROM gateway_archive.protection p WHERE id=$1', [job.recovery_protection_id])).rows[0];
      if (!hold) throw gatewayError('gateway_catalog_dependency');
      const protection = JSON.parse(hold.row);
      if (candidateBatchSha256(job.manifest.retention) !== protection.candidates_sha256) throw gatewayError('gateway_catalog_dependency');
      if (protection.ready_at !== null) record(job.id, 'protection', await evidence(managedArchivePath(archives, job.id), 'protection.json', {
        version: 1, protectionId: protection.id, archiveId: job.id, manifestSha256: job.manifest_sha256,
        candidatesSha256: protection.candidates_sha256, recoveryDays: 30,
      }));
    }
  }, signal);
  return { count, bytes, sha256: digest.digest('hex') };
}
