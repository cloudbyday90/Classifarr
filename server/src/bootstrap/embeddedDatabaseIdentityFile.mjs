/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

/**
 * Fixed bounded read. The caller supplies the operation deadline and join.
 * @param {{signal?: AbortSignal, openFile?: typeof open}} [options]
 */
export async function readEmbeddedDatabaseIdentityFile({ signal, openFile = open } = {}) {
  let file;
  const limit = 2048;
  signal?.throwIfAborted();
  try {
    file = await openFile('/app/data/postgres/postmaster.pid',
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    signal?.throwIfAborted();
    const stat = await file.stat();
    signal?.throwIfAborted();
    if (!stat.isFile() || stat.size >= limit) throw new Error('database_identity_file_invalid');
    const buffer = Buffer.alloc(limit);
    let offset = 0;
    while (offset < limit) {
      const { bytesRead } = await file.read(buffer, offset, limit - offset, offset);
      signal?.throwIfAborted();
      if (bytesRead === 0) return buffer.toString('utf8', 0, offset);
      offset += bytesRead;
    }
    throw new Error('database_identity_file_invalid');
  } finally { await file?.close(); }
}
