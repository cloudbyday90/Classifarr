/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises'

export const SOURCE_READ_BATCH_SIZE = 16

// Bound simultaneous reads and retained source text; never skip an unreadable file.
export async function* readSourceFileBatches(filePaths, { readSource = readFile } = {}) {
  for (let offset = 0; offset < filePaths.length; offset += SOURCE_READ_BATCH_SIZE) {
    const paths = filePaths.slice(offset, offset + SOURCE_READ_BATCH_SIZE)
    const results = await Promise.allSettled(paths.map(async filePath => ({
      filePath,
      source: await readSource(filePath, 'utf8'),
    })))
    // Settle all admitted reads before failing so none outlive this batch.
    const failure = results.find(result => result.status === 'rejected')
    if (failure) throw failure.reason
    yield results.map(result => result.value)
  }
}
