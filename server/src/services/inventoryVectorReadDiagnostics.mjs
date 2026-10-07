/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { channel } from 'node:diagnostics_channel';

export const VECTOR_READ_CHANNEL = 'classifarr.inventory.vector-read.v1';
const diagnostics = channel(VECTOR_READ_CHANNEL);

/** Subscriber-gated, numeric-only observations. No rows or identities leave this function. */
export function observeInventoryVectorBatch(stage, rows, dimensions) {
  if (!diagnostics.hasSubscribers) return;
  let encodedChars = 0;
  try {
    if (!['read', 'decode'].includes(stage) || !Array.isArray(rows) || rows.length > 10000 ||
        !Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000) throw new Error();
    for (const row of rows) {
      if (typeof row.embedding !== 'string') throw new Error();
      encodedChars += row.embedding.length;
      if (encodedChars > 1_000_000_000) throw new Error();
    }
  } catch {
    diagnostics.publish(Object.freeze({ invalid: true }));
    return;
  }
  diagnostics.publish(Object.freeze({ stage, rows: rows.length, components: rows.length * dimensions, encodedChars }));
}
