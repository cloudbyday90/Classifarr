/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { open,link,unlink,lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { archiveDirectory } from './archiveFiles.mjs';
import { archiveUuid,archiveHash } from './archiveRetentionContract.mjs';
import { candidateBatchSha256 } from './archiveProtectionPolicy.mjs';
import { gatewayError } from './errors.mjs';

export const PROTECTION_FILES = ['protection.json','protection.pending'];
const blocked = () => gatewayError('gateway_archive_protection_fence');
function markerFor(job) {
  const hold = job.protection;
  if (!hold || !archiveUuid(hold.id) || hold.id !== job.recovery_protection_id ||
      hold.ledger_id !== job.ledger_id || hold.provider_hash !== job.provider_hash || hold.minimum_recovery_days !== 30 ||
      !archiveHash(hold.candidates_sha256) || candidateBatchSha256(job.manifest.retention) !== hold.candidates_sha256 ||
      !(hold.first_archive_id === job.id && hold.first_manifest_sha256 === job.manifest_sha256 ||
        hold.second_archive_id === job.id && hold.second_manifest_sha256 === job.manifest_sha256)) throw blocked();
  return { version: 1,protectionId: hold.id,archiveId: job.id,manifestSha256: job.manifest_sha256,
    candidatesSha256: hold.candidates_sha256,recoveryDays: 30 };
}

// Only fixed filenames below an ownership-checked private directory; never recursive deletion.
/* eslint-disable security/detect-non-literal-fs-filename */
async function readMarker(path,expected,allowLinked = false) {
  let file;
  try { file = await open(path,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) { if (error.code === 'ENOENT') return null; throw blocked(); }
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.geteuid() || (stat.mode & 0o077) ||
        !(allowLinked ? [1,2] : [1]).includes(stat.nlink) || stat.size > 4096) throw blocked();
    const buffer = Buffer.alloc(4097), { bytesRead } = await file.read(buffer,0,buffer.length,0);
    if (bytesRead > 4096 || !isDeepStrictEqual(expected,JSON.parse(new TextDecoder('utf-8',{ fatal: true })
      .decode(buffer.subarray(0,bytesRead))))) throw blocked();
    await file.sync(); return stat;
  } catch { throw blocked(); } finally { await file.close(); }
}

async function syncMarkerDirectory(directory) {
  const file = await open(directory,constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await file.sync(); } finally { await file.close(); }
}

/** A SQL hold precedes publication. A partial or foreign marker is never overwritten. */
export async function ensureArchiveProtection(directory,job) {
  directory = await archiveDirectory(directory);
  if (!job.recovery_protection_id) {
    for (const name of PROTECTION_FILES) {
      try { await lstat(join(directory,name)); }
      catch (error) { if (error.code === 'ENOENT') continue; throw blocked(); }
      throw blocked();
    }
    return;
  }
  const expected = markerFor(job), pending = join(directory,'protection.pending'), final = join(directory,'protection.json');
  let staged = await readMarker(pending,expected,true);
  if (!staged && await readMarker(final,expected)) { await syncMarkerDirectory(directory); return; }
  // Ready holds must never silently reconstruct missing recovery evidence.
  if (!staged && job.protection.ready_at) throw blocked();
  if (!staged) {
    const file = await open(pending,constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,0o600);
    try { await file.writeFile(`${JSON.stringify(expected)}\n`); await file.sync(); } finally { await file.close(); }
    staged = await readMarker(pending,expected,true);
  }
  try { await link(pending,final); }
  catch (error) {
    if (error.code !== 'EEXIST') throw blocked();
    const published = await lstat(final);
    if (!published.isFile() || published.dev !== staged.dev || published.ino !== staged.ino || published.nlink !== 2) throw blocked();
  }
  await unlink(pending);
  await syncMarkerDirectory(directory);
  await readMarker(final,expected);
}
/* eslint-enable security/detect-non-literal-fs-filename */
