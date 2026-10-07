/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryDescriptionVectorRows, decodeInventoryDescriptionVectorRows } from './inventoryDescriptionVectorCache.mjs';

/** Only the preparation callback may read bounded batches from its owning snapshot. */
export async function withRepresentativePreparationReader(query, identity, snapshot, signal, prepare) {
  let open = true, active = false, pending = null;
  const limit = Math.min(256, Math.floor(262144 / identity.dimensions));
  const readBatch = async hashes => {
    if (!open) throw new Error('representative_preparation_reader_closed');
    signal?.throwIfAborted();
    if (active || !Array.isArray(hashes) || hashes.length > limit || new Set(hashes).size !== hashes.length ||
        hashes.some(hash => !snapshot.corpus.texts.has(hash))) throw new Error('representative_preparation_batch');
    active = true;
    try {
      const rows = await readInventoryDescriptionVectorRows(query, identity, hashes);
      signal?.throwIfAborted();
      if (!open) throw new Error('representative_preparation_reader_closed');
      return decodeInventoryDescriptionVectorRows(rows, identity);
    } finally { active = false; }
  };
  const readVectors = hashes => {
    if (active) return Promise.reject(new Error('representative_preparation_batch'));
    pending = readBatch(hashes);
    // Also observe unjoined reads: the transaction must not release a busy connection.
    pending.catch(() => {});
    return pending;
  };
  try {
    const result = await prepare(snapshot, readVectors);
    signal?.throwIfAborted();
    if (active) throw new Error('representative_preparation_reader_active');
    return result;
  } finally { open = false; await pending?.catch(() => {}); }
}
