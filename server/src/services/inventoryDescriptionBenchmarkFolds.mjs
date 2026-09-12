/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Description groups never cross a test/training boundary, even across media types. */
export function planDescriptionBenchmarkFolds(corpus, sample, libraries, { seed, folds }) {
  if (!Number.isInteger(folds) || folds < 2 || folds > 10 || sample.length > 300 ||
      corpus.documents.length > 50000 || libraries.length > 64) throw new Error('description_benchmark_fold_budget');
  const memberships = new Map(libraries.map(library => [library.id, new Set()]));
  const groups = new Map();
  for (const doc of corpus.documents) {
    if (!groups.has(doc.hash)) groups.set(doc.hash, new Set());
    for (const id of doc.libraryIds) {
      if (!memberships.has(id)) throw new Error('description_benchmark_fold_membership');
      memberships.get(id).add(doc.hash);
      groups.get(doc.hash).add(id);
    }
  }
  const held = Array.from({ length: folds }, () => new Set());
  const counts = Array.from({ length: folds }, () => new Map());
  const foldByHash = new Map();
  const ordered = [...new Set(sample.map(doc => doc.hash))].map(hash => {
    const ids = [...(groups.get(hash) ?? [])].sort((a, b) => a - b);
    if (!ids.length) throw new Error('description_benchmark_fold_membership');
    return { hash, ids, rarest: Math.min(...ids.map(id => memberships.get(id).size)), rank: digest(`${seed}:${hash}`) };
  }).sort((a, b) => a.rarest - b.rarest || compare(a.rank, b.rank));
  for (const group of ordered) {
    // Minimize incremental squared held-out membership load, weighted toward small libraries.
    const load = index => group.ids.reduce((sum, id) => sum + (2 * (counts[index].get(id) ?? 0) + 1) / memberships.get(id).size, 0);
    const index = held.map((_, index) => index).sort((a, b) => load(a) - load(b) || held[a].size - held[b].size || a - b)[0];
    held[index].add(group.hash);
    foldByHash.set(group.hash, index);
    for (const id of group.ids) counts[index].set(id, (counts[index].get(id) ?? 0) + 1);
  }
  const libraryCoverage = [...libraries].sort((a, b) => a.id - b.id).map((library, index) => {
    const inventory = memberships.get(library.id).size;
    const training = counts.map(count => inventory - (count.get(library.id) ?? 0));
    return { stratum: index + 1, mediaType: library.media_type, inventoryDescriptions: inventory,
      sampledDescriptions: ordered.filter(group => group.ids.includes(library.id)).length,
      minimumTrainingDescriptions: Math.min(...training), maximumTrainingDescriptions: Math.max(...training) };
  });
  return { held, foldByHash, summary: { protocol: 'library_grouped_folds_v1', folds,
    assignmentFingerprint: digest(JSON.stringify([...foldByHash].sort(([a], [b]) => compare(a, b)))),
    foldSizes: held.map(hashes => hashes.size), libraryCoverage,
    librariesWithoutTrainingInSomeFold: libraryCoverage.filter(row => row.minimumTrainingDescriptions === 0).length,
    librariesBelowThreeTrainingInSomeFold: libraryCoverage.filter(row => row.minimumTrainingDescriptions < 3).length } };
}
