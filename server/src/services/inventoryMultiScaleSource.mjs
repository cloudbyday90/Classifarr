/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { assertRepresentativeSnapshotBudget, inspectRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { coverageTrainingSnapshot } from './inventoryCoverageMasks.mjs';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';

export const MULTI_SCALE_VERSION = 'inventory_multi_scale_context_v1';

/** Owned content-only snapshot; cache identity includes every input that affects fitting. */
export function prepareMultiScaleSource(snapshot, representation, held) {
  return ownMultiScaleSource(inspectMultiScaleSource(snapshot, representation, held));
}

/** Borrow vectors for synchronous admission; acquire ownership before asynchronous fitting. */
export function inspectMultiScaleSource(snapshot, representation, held) {
  if (!(held instanceof Set) || !held.size) throw new Error('multi_scale_holdout_required');
  return prepareSource(snapshot, representation, held);
}

/** Copy only an admitted new build, synchronously before any caller can mutate its input. */
export function ownMultiScaleSource(source) {
  return { ...source, training: { ...source.training,
    vectors: new Map([...source.training.vectors].map(([hash, vector]) => [hash, [...vector]])) } };
}

/** Separate live contract: full-inventory profiles may retrieve unseen descriptions only. */
export function prepareUnseenMultiScaleSource(snapshot, representation) {
  return ownMultiScaleSource(inspectUnseenMultiScaleSource(snapshot, representation));
}

/** Synchronous live fingerprint without materializing another complete vector copy. */
export function inspectUnseenMultiScaleSource(snapshot, representation) {
  return prepareSource(snapshot, representation, new Set());
}

function prepareSource(snapshot, representation, held) {
  const dimensions = representation?.dimensions;
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  if (typeof representation.model !== 'string' || !representation.model.length || representation.model.length > 200 ||
      typeof representation.digest !== 'string' || !/^[a-f0-9]{64}$/.test(representation.digest) || held.size > 300 ||
      [...held].some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error('multi_scale_source_invalid');
  if (snapshot.vectors.size !== snapshot.corpus.texts.size) throw new Error('multi_scale_complete_cache_required');
  const scope = new Map(snapshot.libraries.map(row => [row.id, row.media_type]));
  if (snapshot.corpus.documents.some(doc => !doc.libraryIds.length || doc.libraryIds.some(id => scope.get(id) !== doc.type))) {
    throw new Error('multi_scale_unscoped_source');
  }
  const training = coverageTrainingSnapshot(snapshot, held);
  // Validate fresh exact values even on hits; ownership is acquired only after admission.
  for (const vector of training.vectors.values()) validateEmbedding(vector, dimensions);
  const { index } = inspectRepresentativeCoverage(training);
  // Canonicalize copies/order; irrelevant names and metadata cannot trigger an expensive refit.
  training.libraries.sort((a, b) => a.id - b.id);
  training.corpus.documents = [...index.groups.values()].map(row => ({ type: row.type, hash: row.hash,
    libraryIds: [...row.libraries].sort((a, b) => a - b) })).sort((a, b) => a.type.localeCompare(b.type) || a.hash.localeCompare(b.hash));
  const digest = createHash('sha256').update(JSON.stringify([MULTI_SCALE_VERSION, representation.model, representation.digest,
    dimensions, [...held].sort(), training.libraries, training.corpus.documents]));
  for (const [hash, vector] of [...training.vectors].sort(([a], [b]) => a.localeCompare(b))) {
    digest.update(hash).update(JSON.stringify(vector));
  }
  return { training, dimensions, held: new Set(held), key: digest.digest('hex') };
}
