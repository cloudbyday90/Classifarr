/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createInventoryMatchCalibration } from './inventoryMatchCalibration.mjs';
import { createPairedInventoryNeighborCalibration } from './inventoryNeighborCalibration.mjs';

/** Snapshot-owned, lazy calibration. Query validation must not admit query rows into fitting. */
export function createLeaderChallengeCalibration(snapshot, representation, trainingByFold) {
  const hashes = new Set(snapshot.corpus.documents.map(doc => doc.hash));
  const exclusions = new Map([...trainingByFold].map(([fold, documents]) => {
    const admitted = new Set(documents.map(doc => doc.hash));
    return [fold, new Set([...hashes].filter(hash => !admitted.has(hash)))];
  }));
  let match, neighbor, crossFitMatch, representativeNeighbor;
  return async (entry, { signal } = {}) => {
    signal?.throwIfAborted();
    const held = exclusions.get(entry?.foldIndex);
    if (!held || !(entry?.heldDescriptionHashes instanceof Set) || !held.has(entry.descriptionHash) ||
        [...entry.heldDescriptionHashes].some(hash => !held.has(hash))) throw new Error('leader_calibration_fold_invalid');
    if (!match) {
      const input = { documents: snapshot.corpus.documents, libraries: snapshot.libraries,
        vectors: snapshot.vectors, representation };
      match = createInventoryMatchCalibration(input);
      const pair = createPairedInventoryNeighborCalibration(input, { diagnostics: true });
      neighbor = pair.ordered;
      crossFitMatch = createInventoryMatchCalibration(input, { crossFit: true });
      representativeNeighbor = pair.representative;
    }
    const query = { ...entry, heldDescriptionHashes: new Set(held) };
    // Sequential fitting avoids overlapping scratch memory; all kernels enforce work budgets.
    const familiar = await match.assess(query, { signal });
    const distinct = await neighbor.assess(query, { signal });
    const crossFitted = await crossFitMatch.assess(query, { signal });
    const selected = await representativeNeighbor.assess(query, { signal });
    return { match: familiar, neighbor: distinct, crossFitMatch: crossFitted, representativeNeighbor: selected };
  };
}
