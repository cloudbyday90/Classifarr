/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { open, readdir, lstat, statfs, unlink, rmdir, link } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { archiveDirectory, readVerifiedGatewayArchive, openArchiveFile } from './archiveFiles.mjs';
import { ARCHIVE_LIMIT, archiveUuid } from './archiveContract.mjs';
import { ARCHIVE_POLICY } from './archiveSchedule.mjs';
import { validateArchiveReceipt } from './onlineArchiveContract.mjs';
import { validateReceiptForArchive } from './archiveReceiptBinding.mjs';
import { gatewayError } from './errors.mjs';
import { PROTECTION_FILES } from './archiveProtectionFiles.mjs';

export function managedArchivePath(parent, id) {
  if (!archiveUuid(id)) throw gatewayError('gateway_archive_file_invalid');
  return join(parent, `gateway-archive-${id}`);
}

// All paths below come from private operator directories, fixed filenames and validated UUIDv7 IDs.
/* eslint-disable security/detect-non-literal-fs-filename */
async function syncDirectory(path) {
  const file = await open(await archiveDirectory(path), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await file.sync(); } finally { await file.close(); }
}

export async function archiveStorageAvailable(parent, receipts, jobs, additionalParents = []) {
  parent = await archiveDirectory(parent); receipts = await archiveDirectory(receipts);
  if (!Array.isArray(additionalParents) || additionalParents.length > 1) throw gatewayError('gateway_archive_storage_blocked');
  const parents = [parent, ...await Promise.all(additionalParents.map(archiveDirectory))];
  if (new Set(parents).size !== parents.length) throw gatewayError('gateway_archive_storage_blocked');
  const known = new Map(jobs.map(job => [`gateway-archive-${job.id}`, job]));
  let bytes = 0n;
  for (const archiveParent of parents) {
    const entries = await readdir(archiveParent);
    if (entries.length > 10000) throw gatewayError('gateway_archive_storage_blocked');
    for (const name of entries) {
      const job = known.get(name);
      if (!job) throw gatewayError('gateway_archive_unmanaged_files');
      const directory = await archiveDirectory(join(archiveParent,name));
      const files = await readdir(directory);
      if (files.some(file => !['gateway.dump','manifest.json',...(job.recovery_protection_id ? PROTECTION_FILES : [])].includes(file))) {
        throw gatewayError('gateway_archive_unmanaged_files');
      }
      for (const file of files) {
        const stat = await lstat(join(directory,file));
        if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.geteuid() || (stat.mode & 0o077) || !Number.isSafeInteger(stat.size)) throw gatewayError('gateway_archive_file_invalid');
        bytes += BigInt(stat.size);
      }
    }
  }
  const results = await readdir(receipts);
  if (results.length > 10000) throw gatewayError('gateway_archive_storage_blocked');
  const ids = new Set(jobs.flatMap(job => [`${job.id}.json`,`${job.id}.pending`]));
  for (const name of results) {
    if (!ids.has(name)) throw gatewayError('gateway_archive_unmanaged_files');
    const stat = await lstat(join(receipts,name));
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.geteuid() || (stat.mode & 0o077) || !Number.isSafeInteger(stat.size)) throw gatewayError('gateway_archive_file_invalid');
    bytes += BigInt(stat.size);
  }
  const reserve = BigInt(ARCHIVE_LIMIT + 131072);
  const free = await statfs(parent, { bigint: true });
  return bytes + reserve <= BigInt(ARCHIVE_POLICY.budgetBytes) && free.bavail >= 0n && free.bsize > 0n &&
    free.bavail * free.bsize >= reserve + 67108864n;
}

export async function readArchiveReceipt(parent, id, validate = validateArchiveReceipt) {
  if (!archiveUuid(id)) throw gatewayError('gateway_archive_receipt_invalid');
  let file;
  try {
    file = await open(join(await archiveDirectory(parent),`${id}.json`), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.geteuid() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size > 4096) throw new Error();
    const buffer = Buffer.alloc(4097); const { bytesRead } = await file.read(buffer,0,buffer.length,0);
    if (bytesRead > 4096) throw new Error();
    return validate(JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(buffer.subarray(0,bytesRead))));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw gatewayError('gateway_archive_receipt_invalid');
  } finally { await file?.close(); }
}

export async function writeArchiveReceipt(parent, receipt, validate = validateArchiveReceipt) {
  validate(receipt); parent = await archiveDirectory(parent);
  const pending = join(parent,`${receipt.archiveId}.pending`), final = join(parent,`${receipt.archiveId}.json`);
  const file = await open(pending, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,0o600);
  try { await file.writeFile(`${JSON.stringify(receipt)}\n`); await file.sync(); } finally { await file.close(); }
  await link(pending,final); await unlink(pending);
  await syncDirectory(parent);
}

/** Finish a fully written receipt after a crash between write/link/unlink; never overwrite a published result. */
export async function recoverArchiveReceiptPublication(parent,id,validate = validateArchiveReceipt) {
  if (!archiveUuid(id)) throw gatewayError('gateway_archive_receipt_invalid');
  parent = await archiveDirectory(parent);
  const pending = join(parent,`${id}.pending`), final = join(parent,`${id}.json`);
  let file;
  try {
    file = await open(pending,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.geteuid() || ![1,2].includes(stat.nlink) || (stat.mode & 0o077) || stat.size > 4096) throw new Error();
    const buffer = Buffer.alloc(4097), result = await file.read(buffer,0,buffer.length,0);
    if (result.bytesRead > 4096) throw new Error();
    const receipt = validate(JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(buffer.subarray(0,result.bytesRead))));
    if (receipt.archiveId !== id) throw new Error();
    await file.sync();
    try { await link(pending,final); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const published = await lstat(final);
      if (!published.isFile() || published.dev !== stat.dev || published.ino !== stat.ino || published.nlink !== 2) throw new Error();
    }
    await unlink(pending); await syncDirectory(parent);
  } catch (error) {
    if (error.code !== 'ENOENT') throw gatewayError('gateway_archive_receipt_invalid');
  } finally { await file?.close(); }
}

/** No recursive deletion. Exactly the two known files, in a registered verified bundle. */
export async function retireManagedArchive(parent, job, signal) {
  if (job.status !== 'retiring' || !job.receipt?.verified) throw gatewayError('gateway_archive_rotation_blocked');
  return retireArchiveFiles(parent, job, signal);
}

/** Shared fixed-file removal, only after the caller's durable retirement and evidence checks. */
export async function retireArchiveFiles(parent, job, signal) {
  if (job.status !== 'retiring') throw gatewayError('gateway_archive_rotation_blocked');
  signal?.throwIfAborted();
  parent = await archiveDirectory(parent);
  const directory = managedArchivePath(parent,job.id);
  try { await lstat(directory); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  await archiveDirectory(directory);
  const names = await readdir(directory);
  if (names.some(name => !['manifest.json','gateway.dump'].includes(name))) throw gatewayError('gateway_archive_rotation_blocked');
  // The durable retiring state was written only after complete verification. On restart, only finish deleting its fixed files.
  for (const name of names) {
    const stat = await lstat(join(directory,name));
    if (!stat.isFile() || stat.uid !== process.geteuid() || stat.nlink !== 1 || (stat.mode & 0o077)) throw gatewayError('gateway_archive_rotation_blocked');
    const file = await openArchiveFile(directory,name), digest = createHash('sha256'), buffer = Buffer.alloc(65536);
    let length = 0;
    try {
      for (;;) {
        signal?.throwIfAborted();
        const { bytesRead } = await file.read(buffer,0,buffer.length,null);
        if (!bytesRead) break;
        length += bytesRead;
        if (length > (name === 'manifest.json' ? 65536 : ARCHIVE_LIMIT)) throw gatewayError('gateway_archive_rotation_blocked');
        digest.update(buffer.subarray(0,bytesRead));
      }
      if (digest.digest('hex') !== (name === 'manifest.json' ? job.manifest_sha256 : job.manifest.dump.sha256)) {
        throw gatewayError('gateway_archive_rotation_blocked');
      }
    } finally { await file.close(); }
  }
  for (const name of ['manifest.json','gateway.dump']) if (names.includes(name)) {
    signal?.throwIfAborted(); await unlink(join(directory,name));
  }
  signal?.throwIfAborted();
  await rmdir(directory); await syncDirectory(parent);
}
/* eslint-enable security/detect-non-literal-fs-filename */

export async function checkManagedArchive(parent, job, signal) {
  const value = await readVerifiedGatewayArchive(managedArchivePath(parent,job.id),signal);
  if (![3, 4].includes(value.manifest.version) || value.manifest.archiveId !== job.id || value.manifestSha256 !== job.manifest_sha256 ||
      !isDeepStrictEqual(value.manifest,job.manifest)) throw gatewayError('gateway_archive_job_fence');
  if (job.receipt) validateReceiptForArchive(job.receipt,value.manifest,value.manifestSha256);
  return value;
}
