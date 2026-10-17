/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { mkdir, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { archiveDirectory, openArchiveFile } from './archiveFiles.mjs';
import { ARCHIVE_LIMIT } from './archiveContract.mjs';
import { gatewayError } from './errors.mjs';

/** Private scratch is bounded by the verifier's existing 1 GiB tmpfs, not managed archive storage. */
export async function stageArchiveRestoreInput(directory, workspace, dump, signal) {
  workspace = await archiveDirectory(workspace);
  if (!Number.isSafeInteger(dump?.bytes) || dump.bytes < 5 || dump.bytes > ARCHIVE_LIMIT ||
      !/^[a-f0-9]{64}$/.test(dump.sha256 ?? '')) throw gatewayError('gateway_archive_restore_contract');
  let source, target;
  try {
    signal?.throwIfAborted();
    // Reserve the copy plus at least the same amount for restoration and 64 MiB
    // headroom. This is an admission check, not a claim about maximum restored size.
    const space = await statfs(workspace, { bigint: true });
    if (space.bavail * space.bsize < 2n * BigInt(dump.bytes) + 67108864n) {
      throw gatewayError('gateway_archive_scratch_full');
    }
    const input = join(workspace, 'input');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed child of this invocation's private mkdtemp workspace.
    await mkdir(input, { mode: 0o700 });
    source = await openArchiveFile(directory, 'gateway.dump');
    target = await openArchiveFile(input, 'gateway.dump', true);
    const buffer = Buffer.alloc(65536), header = Buffer.alloc(5), digest = createHash('sha256');
    let bytes = 0;
    for (;;) {
      signal?.throwIfAborted();
      const { bytesRead } = await source.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      if (bytes < header.length) buffer.copy(header, bytes, 0, Math.min(bytesRead, header.length - bytes));
      bytes += bytesRead;
      if (bytes > dump.bytes) throw gatewayError('gateway_archive_restore_mismatch');
      const chunk = buffer.subarray(0, bytesRead);
      digest.update(chunk);
      await target.writeFile(chunk);
    }
    if (bytes !== dump.bytes || header.toString() !== 'PGDMP' || digest.digest('hex') !== dump.sha256) {
      throw gatewayError('gateway_archive_restore_mismatch');
    }
    signal?.throwIfAborted();
    await target.sync();
    await target.chmod(0o400);
    // Close both descriptors before publishing the private path to native pg_restore.
    await target.close(); target = null;
    await source.close(); source = null;
    signal?.throwIfAborted();
    return join(input, 'gateway.dump');
  } catch (error) {
    if (signal?.aborted) throw gatewayError('gateway_archive_cancelled');
    if (['gateway_archive_scratch_full', 'gateway_archive_restore_mismatch'].includes(error.code)) throw error;
    throw gatewayError('gateway_archive_restore_input_failed');
  } finally {
    try { try { await target?.close(); } finally { await source?.close(); } }
    catch { throw gatewayError(signal?.aborted ? 'gateway_archive_cancelled' : 'gateway_archive_restore_input_failed'); }
    // The verifier owns cleanup of its entire private workspace, including partial copies.
  }
}
