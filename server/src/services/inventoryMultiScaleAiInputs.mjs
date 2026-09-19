/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';

/** Audited paired-AI inputs only. Other experiments retain their full snapshot contract. */
export function describeMultiScaleAiInputs(snapshot) {
  const base = describeInventorySnapshotDigests({
    libraries: snapshot.libraries.map(({ id, media_type }) => ({ id, media_type })),
    corpus: { documents: snapshot.corpus.documents.map(({ key, type, hash, libraryIds }) => ({ key, type, hash, libraryIds })) },
  }, snapshot.vectors);
  const descriptions = createHash('sha256').update('inventory_multi_scale_ai_inputs_v1\n');
  // Hash the text actually consumed, not just a caller-provided content hash.
  for (const [hash, text] of [...snapshot.corpus.texts].sort(([a], [b]) => a.localeCompare(b))) {
    descriptions.update(JSON.stringify([hash, text])).update('\n');
  }
  return { version: 'inventory_multi_scale_ai_inputs_v1',
    counts: { documents: base.counts.documents, libraries: base.counts.libraries,
      vectors: base.counts.vectors, descriptions: snapshot.corpus.texts.size },
    hashes: { documents: base.hashes.documents, libraries: base.hashes.libraries,
      vectors: base.hashes.vectors, descriptions: descriptions.digest('hex') } };
}
