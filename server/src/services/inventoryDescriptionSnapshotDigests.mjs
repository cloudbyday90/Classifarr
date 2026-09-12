/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const canonicalize = value => Array.isArray(value) ? value.map(canonicalize)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])])) : value;
const digestRecords = records => {
  const digest = createHash('sha256').update('inventory_description_snapshot_v1\n');
  for (const record of records) digest.update(JSON.stringify(canonicalize(record))).update('\n');
  return digest.digest('hex');
};

/** Aggregate provenance only. No individual content hashes or raw data leave this helper. */
export function describeInventorySnapshotDigests(snapshot, rawVectors) {
  const documents = [...snapshot.corpus.documents].sort((a, b) => compare(a.key, b.key))
    .map(doc => ({ ...doc, libraryIds: [...doc.libraryIds].sort((a, b) => a - b) }));
  const libraries = [...snapshot.libraries].sort((a, b) => a.id - b.id);
  const vectors = [...rawVectors].sort(([a], [b]) => compare(a, b));
  const metadata = [...(snapshot.candidateMetadata ?? new Map())].sort(([a], [b]) => compare(a, b));
  return { version: 'inventory_description_snapshot_v1',
    counts: { documents: documents.length, libraries: libraries.length, vectors: vectors.length, metadata: metadata.length },
    hashes: { documents: digestRecords(documents), libraries: digestRecords(libraries),
      vectors: digestRecords(vectors), metadata: digestRecords(metadata) } };
}
