/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { readInventoryDescriptionVectorRows, decodeInventoryDescriptionVectorRows } from './inventoryDescriptionVectorCache.mjs';
import { prepareMultiScaleSourceMetadata } from './inventoryMultiScaleSourceMetadata.mjs';
import { createInventoryVectorFingerprint } from './inventoryVectorFingerprint.mjs';

// End both encoded and decoded batch lifetimes before yielding to another query.
async function fingerprintBatch(query, identity, hashes, included, append, signal) {
  const rows = await readInventoryDescriptionVectorRows(query, identity, hashes);
  signal?.throwIfAborted();
  const vectors = decodeInventoryDescriptionVectorRows(rows, identity);
  if (vectors.size !== hashes.length) throw new Error('multi_scale_complete_cache_required');
  for (const hash of hashes) if (included.has(hash)) append(hash, vectors.get(hash));
}

/** Read every exact value in the caller's fresh transaction, retaining only a digest. */
export async function fingerprintMultiScaleVerification(query, identity, snapshot, signal) {
  const { training, digest } = prepareMultiScaleSourceMetadata(snapshot, identity, new Set());
  const append = createInventoryVectorFingerprint(digest, identity.dimensions);
  const hashes = [...snapshot.corpus.texts.keys()].sort((a, b) => a.localeCompare(b));
  const batchSize = Math.min(256, Math.floor(262144 / identity.dimensions));
  for (let offset = 0; offset < hashes.length; offset += batchSize) {
    signal?.throwIfAborted();
    await fingerprintBatch(query, identity, hashes.slice(offset, offset + batchSize), training.corpus.texts, append, signal);
    await setImmediate(undefined, { signal });
  }
  signal?.throwIfAborted();
  return digest.digest('hex');
}
