/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertRepresentativeSnapshotBudget } from './inventoryRepresentativeCoverage.mjs';
import { prepareMultiScaleSourceMetadata } from './inventoryMultiScaleSourceMetadata.mjs';
import { updateInventoryVectorFingerprint } from './inventoryVectorFingerprint.mjs';

export { MULTI_SCALE_VERSION } from './inventoryMultiScaleSourceMetadata.mjs';

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
  assertRepresentativeSnapshotBudget(snapshot, representation?.dimensions);
  const { training, dimensions, digest, held: ownedHeld } = prepareMultiScaleSourceMetadata(snapshot, representation, held);
  if (snapshot.vectors.size !== snapshot.corpus.texts.size) throw new Error('multi_scale_complete_cache_required');
  training.vectors = new Map([...snapshot.vectors].filter(([hash]) => training.corpus.texts.has(hash)));
  // Validate and fingerprint fresh exact values even on hits; copy only after admission.
  updateInventoryVectorFingerprint(digest, training.vectors, dimensions);
  return { training, dimensions, held: ownedHeld, key: digest.digest('hex') };
}
