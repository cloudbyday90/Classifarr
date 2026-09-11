/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';

export const INVENTORY_DESCRIPTION_CACHE_LOCK = 0x49445247;

export async function inspectDescriptionRepresentation(embedder, signal) {
  signal?.throwIfAborted();
  const identity = await embedder.inspect({ signal });
  validateDescriptionRepresentation(identity);
  if (identity.model !== embedder.model || identity.provider !== embedder.provider) {
    throw new Error('inventory_description_provider_changed');
  }
  return identity;
}

export async function verifyDescriptionRepresentation(embedder, identity, signal) {
  const current = await inspectDescriptionRepresentation(embedder, signal);
  if (current.digest !== identity.digest || current.dimensions !== identity.dimensions ||
      current.model !== identity.model || current.provider !== identity.provider) {
    throw new Error('inventory_description_model_changed');
  }
}

/** Admission is cooperative. An interrupted/unverified batch never enters the cache. */
export async function writeInventoryDescriptionBatch({
  embedder, identity, cache, signal, hashes, texts, admit = async () => true,
}) {
  signal?.throwIfAborted();
  if (!await admit()) return null;
  signal?.throwIfAborted();
  const batch = await embedder.embedBatch(hashes.map(hash => texts.get(hash)),
    { dimensions: identity.dimensions, signal });
  if (!Array.isArray(batch) || batch.length !== hashes.length) throw new Error('inventory_description_batch_invalid');
  // Match pgvector's float32 storage before both cold and warm scoring.
  const entries = batch.map((vector, index) => ({ hash: hashes[index],
    vector: validateEmbedding(vector, identity.dimensions).map(Math.fround) }));
  if (!await admit()) return null;
  await verifyDescriptionRepresentation(embedder, identity, signal);
  if (!await admit()) return null;
  signal?.throwIfAborted();
  await cache.write(identity, entries);
  return entries;
}
