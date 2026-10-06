/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { readInventoryDescriptionVectorRows, decodeInventoryDescriptionVectorRows,
  validateDescriptionRepresentation, validateInventoryDescriptionHashes } from './inventoryDescriptionVectorCache.mjs';

// End the encoded batch's scope before yielding or requesting another batch.
async function appendBatch(query, identity, hashes, vectors, signal) {
  const rows = await readInventoryDescriptionVectorRows(query, identity, hashes);
  signal?.throwIfAborted();
  for (const [hash, vector] of decodeInventoryDescriptionVectorRows(rows, identity)) vectors.set(hash, vector);
}

/** The caller owns one read-only snapshot; return no partial result on failure. */
export async function readInventoryDescriptionVectors(query, identity, hashes, { signal } = {}) {
  validateDescriptionRepresentation(identity);
  validateInventoryDescriptionHashes(hashes, 10000);
  signal?.throwIfAborted();
  const vectors = new Map(), batchSize = Math.min(256, Math.floor(262144 / identity.dimensions));
  for (let offset = 0; offset < hashes.length; offset += batchSize) {
    signal?.throwIfAborted();
    await appendBatch(query, identity, hashes.slice(offset, offset + batchSize), vectors, signal);
    await yieldTurn(undefined, { signal });
  }
  signal?.throwIfAborted();
  return vectors;
}
