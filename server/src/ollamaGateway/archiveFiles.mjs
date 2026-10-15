/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { open, realpath, lstat, mkdir } from 'node:fs/promises';
import { resolve, join, isAbsolute, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { gatewayError } from './errors.mjs';
import { ARCHIVE_LIMIT, archiveUuid, validateArchiveManifest } from './archiveContract.mjs';

/** Local private directories only. Parent ownership is an operator trust boundary. */
export async function archiveDirectory(path) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- reject symlink components in the explicit offline operator directory.
    if (process.platform !== 'linux' || typeof path !== 'string' || !isAbsolute(path) || await realpath(path) !== resolve(path)) throw new Error();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit offline operator path, never HTTP input.
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.uid !== process.geteuid() || (stat.mode & 0o077)) throw new Error();
    return resolve(path);
  } catch { throw gatewayError('gateway_archive_file_invalid'); }
}

export async function createArchiveDirectory(parent, id) {
  if (!archiveUuid(id)) throw gatewayError('gateway_archive_file_invalid');
  const path = join(await archiveDirectory(parent), `gateway-archive-${id}`);
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated private parent and generated UUIDv7 basename; exclusive mkdir.
    await mkdir(path, { mode: 0o700 });
    return path;
  } catch { throw gatewayError('gateway_archive_file_invalid'); }
}

export async function openArchiveFile(directory, name, writing = false) {
  if (!['gateway.dump', 'manifest.json'].includes(name)) throw gatewayError('gateway_archive_file_invalid');
  const path = join(await archiveDirectory(directory), name);
  let file;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed filename in validated private directory, exclusive creation or no-follow read.
    file = await open(path, (writing ? constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL : constants.O_RDONLY) |
      constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.geteuid() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size > ARCHIVE_LIMIT) throw new Error();
    return file;
  } catch { await file?.close(); throw gatewayError('gateway_archive_file_invalid'); }
}

export async function finishArchive(directory, manifest) {
  validateArchiveManifest(manifest);
  const data = `${JSON.stringify(manifest)}\n`, file = await openArchiveFile(directory, 'manifest.json', true);
  try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
  // Persist the completion marker and the new bundle directory after syncing file contents.
  for (const path of [directory, dirname(directory)]) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated private archive directory and its private parent.
    const folder = await open(await archiveDirectory(path), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await folder.sync(); } finally { await folder.close(); }
  }
  return { archiveId: manifest.archiveId, manifestSha256: createHash('sha256').update(data).digest('hex'),
    bytes: manifest.dump.bytes, purgeAuthorized: false };
}

export async function verifyGatewayArchive(directory, signal) {
  directory = await archiveDirectory(directory);
  let file;
  try {
    // Read the checked descriptor, bounded even if another local process grows the file.
    const marker = await openArchiveFile(directory, 'manifest.json');
    let manifest;
    try {
      const data = Buffer.alloc(65537); let length = 0;
      while (length < data.length) {
        signal?.throwIfAborted();
        const { bytesRead } = await marker.read(data, length, data.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > 65536) throw new Error();
      manifest = validateArchiveManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(0, length))));
    } finally { await marker.close(); }
    file = await openArchiveFile(directory, 'gateway.dump');
    const digest = createHash('sha256'), buffer = Buffer.alloc(65536); let bytes = 0;
    for (;;) {
      signal?.throwIfAborted();
      const result = await file.read(buffer, 0, buffer.length, null);
      if (!result.bytesRead) break;
      if (bytes === 0 && buffer.subarray(0, 5).toString() !== 'PGDMP') throw new Error();
      bytes += result.bytesRead;
      if (bytes > ARCHIVE_LIMIT) throw new Error();
      digest.update(buffer.subarray(0, result.bytesRead));
    }
    if (bytes !== manifest.dump.bytes || digest.digest('hex') !== manifest.dump.sha256) throw new Error();
    return { archiveId: manifest.archiveId, bytes, integrity: 'verified', restoreVerified: false, purgeAuthorized: false };
  } catch { throw gatewayError(signal?.aborted ? 'gateway_archive_cancelled' : 'gateway_archive_verification_failed'); }
  finally { await file?.close(); }
}
