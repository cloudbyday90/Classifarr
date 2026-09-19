/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { inspectRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { normalizeDescriptionVector, descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';

export const COVERAGE_BENCHMARK_ARMS = Object.freeze([
  'complete', 'random_10', 'concentrated_10', 'random_20', 'concentrated_20', 'smallest_group',
]);
const digest = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Remove all copies before fitting, with no plaintext, metadata or runtime state carried forward. */
export function coverageTrainingSnapshot(snapshot, held) {
  const documents = snapshot.corpus.documents.filter(doc => !held.has(doc.hash))
    .map(({ type, hash, libraryIds }) => ({ type, hash, libraryIds: [...libraryIds] }));
  const hashes = new Set(documents.map(doc => doc.hash));
  return { libraries: snapshot.libraries.map(({ id, media_type }) => ({ id, media_type })),
    corpus: { documents, texts: new Map([...hashes].map(hash => [hash, null])) },
    vectors: new Map([...snapshot.vectors].filter(([hash]) => hashes.has(hash))) };
}

/** The source is already held-out. Neither query vectors nor placement labels enter masking. */
export function createCoverageMask(snapshot, dimensions, arm, seed, baseline) {
  if (!COVERAGE_BENCHMARK_ARMS.includes(arm)) throw new Error('coverage_benchmark_arm_invalid');
  const missing = new Set();
  if (arm === 'complete') return missing;
  const { index } = inspectRepresentativeCoverage(snapshot);
  const buckets = new Map([...index.scope.keys()].map(id => [id, []]));
  for (const group of index.groups.values()) if (group.libraries.size === 1) {
    buckets.get([...group.libraries][0]).push(group.hash);
  }
  for (const [id, hashes] of buckets) {
    const ordered = hashes.map(hash => ({ hash, rank: digest(`${seed}:${id}:${hash}`) }))
      .sort((a, b) => compare(a.rank, b.rank));
    if (!ordered.length) continue;
    if (arm === 'smallest_group') {
      const profile = baseline.libraries.get(id), start = profile.starts[profile.selectedStart];
      // An unconverged or sparse fit cannot define a meaningful learned-group mask.
      if (!start.converged || !start.groups.length) continue;
      const groups = start.groups.map(group => ({ centroid: normalizeDescriptionVector(group.centroid, dimensions), hashes: [] }));
      for (const { hash } of ordered) {
        const vector = normalizeDescriptionVector(snapshot.vectors.get(hash), dimensions);
        const scores = groups.map((group, index) => ({ index, score: descriptionCosineSimilarity(vector, group.centroid) }));
        scores.sort((a, b) => b.score - a.score || a.index - b.index);
        groups[scores[0].index].hashes.push(hash);
      }
      const smallest = groups.filter(group => group.hashes.length).sort((a, b) => a.hashes.length - b.hashes.length)[0];
      for (const hash of smallest.hashes) missing.add(hash);
      continue;
    }
    if (arm.startsWith('concentrated')) {
      const anchor = normalizeDescriptionVector(snapshot.vectors.get(ordered[0].hash), dimensions);
      for (const row of ordered) row.score = descriptionCosineSimilarity(anchor,
        normalizeDescriptionVector(snapshot.vectors.get(row.hash), dimensions));
      ordered.sort((a, b) => b.score - a.score || compare(a.rank, b.rank));
    }
    const count = Math.floor(hashes.length * (arm.endsWith('_10') ? 10 : 20) / 100);
    for (const { hash } of ordered.slice(0, count)) missing.add(hash);
  }
  return missing;
}
