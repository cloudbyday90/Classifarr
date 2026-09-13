/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { prepareDescriptionBenchmark } from './inventoryDescriptionBenchmarkSample.mjs';
import { learnInventoryProfiles } from './inventoryLearnedProfiles.mjs';
import { meanInventoryProfileFields, scoreInventoryProfileFields } from './inventoryProfileScoring.mjs';

/** Project private metadata into bounded numeric channels, retaining fold exclusions. */
export function prepareInventoryRerankerRows(snapshot, prepared) {
  const models = new Map();
  return prepared.cases.map(entry => {
    if (!(entry.heldDescriptionHashes instanceof Set) || !entry.heldDescriptionHashes.has(entry.descriptionHash)) {
      throw new Error('inventory_reranker_holdout_required');
    }
    // Cache by the actual exclusion-set object, not an untrusted fold number.
    const held = entry.heldDescriptionHashes;
    if (!models.has(held)) models.set(held, learnInventoryProfiles(snapshot.corpus.documents,
      snapshot.candidateMetadata, snapshot.libraries, held));
    const model = models.get(held), metadata = snapshot.candidateMetadata?.get(`${entry.mediaType}:${entry.itemIdentity.tmdbId}`);
    const available = entry.investigationCandidates;
    const complete = available.length >= 2 && available.length <= 64 && available.every(candidate =>
      candidate.media_type === entry.mediaType && candidate.eligible >= 3 && candidate.items.length >= 3);
    const candidates = complete ? available.map(candidate => {
      const fields = scoreInventoryProfileFields(model, candidate.id, metadata);
      return { id: candidate.id, description: candidate.rank, profileFit: meanInventoryProfileFields(fields), ...fields };
    }) : [];
    return { entry, candidates, observedLibraryIds: entry.observedLibraryIds };
  });
}

/** The entire outer held-out description group is removed BEFORE inner sample selection. */
export function prepareInventoryRerankerTraining(snapshot, dimensions, options, held) {
  const documents = snapshot.corpus.documents.filter(doc => !held.has(doc.hash));
  const hashes = new Set(documents.map(doc => doc.hash));
  const training = { ...snapshot, corpus: { ...snapshot.corpus, documents,
    texts: new Map([...snapshot.corpus.texts].filter(([hash]) => hashes.has(hash))) } };
  const seed = createHash('sha256').update(`inventory_evidence_reranker_v1:${options.seed}`).digest('hex');
  const prepared = prepareDescriptionBenchmark(training, snapshot.vectors, dimensions,
    { ...options, seed, size: 100, folds: 3, generateCases: 0, excludePriorSize: 0, excludePriorSizes: [] },
    { includeComparisonEvidence: true });
  return prepareInventoryRerankerRows(training, prepared).filter(row => row.candidates.length);
}
