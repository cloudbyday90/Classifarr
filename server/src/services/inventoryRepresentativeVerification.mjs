/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { readInventoryDescriptionVectorRows, decodeInventoryDescriptionVectorRows } from './inventoryDescriptionVectorCache.mjs';
import { createRepresentativeFingerprint } from './inventoryRepresentativeFingerprint.mjs';

// Neither transport rows nor decoded vectors escape this batch's scope.
async function fingerprintBatch(query, identity, hashes, fingerprint, signal, presentHashes) {
  const rows = await readInventoryDescriptionVectorRows(query, identity, hashes);
  signal?.throwIfAborted();
  const vectors = decodeInventoryDescriptionVectorRows(rows, identity);
  for (const hash of hashes) {
    fingerprint.append(hash, vectors.has(hash), vectors.get(hash));
    if (vectors.has(hash)) presentHashes?.add(hash);
  }
}

/** Partial coverage is valid evidence, unlike the complete-only comparison contract. */
export async function fingerprintRepresentativeVerification(query, identity, snapshot, configKey, signal, presentHashes = null) {
  signal?.throwIfAborted();
  const fingerprint = createRepresentativeFingerprint(snapshot, identity, configKey);
  const hashes = [...snapshot.corpus.texts.keys()].sort();
  const batchSize = Math.min(256, Math.floor(262144 / identity.dimensions));
  for (let offset = 0; offset < hashes.length; offset += batchSize) {
    signal?.throwIfAborted();
    await fingerprintBatch(query, identity, hashes.slice(offset, offset + batchSize), fingerprint, signal, presentHashes);
    await setImmediate(undefined, { signal });
  }
  signal?.throwIfAborted();
  return fingerprint.finish();
}
