/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { normalizeDescriptionVector, descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';
import { rankInventoryMetadataCandidates } from './inventoryMetadataCandidates.mjs';
import { learnInventoryProfiles, rankInventoryLearnedCandidates, scoreInventoryProfile, INVENTORY_LEARNED_PROFILE_VERSION } from './inventoryLearnedProfiles.mjs';
import { validateDescriptionBenchmarkOptions, selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { preserveInventoryDescriptionCandidate, INVENTORY_DESCRIPTION_ANCHOR_VERSION } from './inventoryDescriptionCandidateAnchor.mjs';
import { summarizeDescriptionAnchorSelection } from './inventoryDescriptionCandidateMetrics.mjs';
export { validateDescriptionBenchmarkOptions, selectDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Freeze vectors, candidate selection and neighbor ordering for all three arms. */
export function prepareDescriptionBenchmark(snapshot, rawVectors, dimensions, options,
  { metadataCandidates = false, learnedProfiles = false, includeContrastiveVectors = false, includeComparisonEvidence = false,
    includeConflictEvidence = false, preserveDescriptionCandidate = false } = {}) {
  if (metadataCandidates && learnedProfiles) throw new Error('description_benchmark_selection_mode_conflict');
  const { folds } = validateDescriptionBenchmarkOptions(options);
  if (includeConflictEvidence && (!folds || !learnedProfiles)) throw new Error('inventory_conflict_evidence_requires_grouped_profiles');
  if (preserveDescriptionCandidate && (!folds || !learnedProfiles)) throw new Error('description_anchor_requires_grouped_profiles');
  const { sample, excluded, priorCohortSizes, priorSampleFingerprints } = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options);
  if (!folds && excluded.size > 0) {
    const corpus = { ...snapshot.corpus, documents: snapshot.corpus.documents.filter(doc => !excluded.has(doc.hash)),
      texts: new Map([...snapshot.corpus.texts].filter(([hash]) => !excluded.has(hash))) };
    return { ...prepareDescriptionBenchmark({ ...snapshot, corpus }, rawVectors, dimensions,
      { ...options, excludePriorSize: 0, excludePriorSizes: [] },
      { metadataCandidates, learnedProfiles, includeContrastiveVectors, includeComparisonEvidence, includeConflictEvidence,
        preserveDescriptionCandidate }), excludedPriorDescriptions: excluded.size };
  }
  const usesMetadata = metadataCandidates || learnedProfiles;
  const selectionVersion = learnedProfiles ? INVENTORY_LEARNED_PROFILE_VERSION +
    (preserveDescriptionCandidate ? `:${INVENTORY_DESCRIPTION_ANCHOR_VERSION}` : '') : 'metadata_rrf_v1';
  const { corpus, libraries } = snapshot;
  if (corpus.texts.size * dimensions > 20_000_000) throw new Error('description_benchmark_vector_budget');
  const vectors = new Map([...corpus.texts.keys()].map(hash => [hash, normalizeDescriptionVector(rawVectors.get(hash), dimensions)]));
  const plan = folds ? planDescriptionBenchmarkFolds(corpus, sample, libraries, { seed: options.seed, folds }) : null;
  const contexts = (plan?.held ?? [new Set(sample.map(doc => doc.hash))]).map(held => {
    const learned = learnedProfiles ? learnInventoryProfiles(corpus.documents, snapshot.candidateMetadata, libraries, held) : null;
    const metadataExamples = corpus.documents.filter(doc => !held.has(doc.hash))
      .map(doc => ({ ...doc, metadata: snapshot.candidateMetadata?.get(doc.key) }));
    const membership = new Map();
    for (const doc of metadataExamples) {
      const key = `${doc.type}:${doc.hash}`;
      if (!membership.has(key)) membership.set(key, { type: doc.type, hash: doc.hash, libraryIds: new Set() });
      for (const id of doc.libraryIds) membership.get(key).libraryIds.add(id);
    }
    return { learned, metadataExamples, membership };
  });
  const cases = sample.map((doc, caseIndex) => {
    const foldIndex = plan?.foldByHash.get(doc.hash) ?? 0;
    const { learned, metadataExamples, membership } = contexts[foldIndex];
    const query = vectors.get(doc.hash);
    const scored = [...membership.values()].filter(entry => entry.type === doc.type)
      .map(entry => ({ ...entry, similarity: descriptionCosineSimilarity(query, vectors.get(entry.hash)) }))
      .sort((a, b) => b.similarity - a.similarity || compare(a.hash, b.hash));
    const ranked = libraries.filter(library => library.media_type === doc.type).map(library => {
      const items = scored.filter(entry => entry.libraryIds.has(library.id));
      const top = items.slice(0, 3);
      return { ...library, items: items.slice(0, 100), eligible: items.length,
        rank: top.length ? top.reduce((sum, item) => sum + item.similarity, 0) / top.length : -2 };
    }).sort((a, b) => b.rank - a.rank || a.id - b.id);
    const unprotected = learned ? rankInventoryLearnedCandidates(ranked, snapshot.candidateMetadata?.get(doc.key), learned)
      : metadataCandidates ? rankInventoryMetadataCandidates(ranked, snapshot.candidateMetadata?.get(doc.key),
        metadataExamples.filter(example => example.type === doc.type)) : ranked;
    const protectedIds = preserveDescriptionCandidate ? preserveInventoryDescriptionCandidate(unprotected.map(candidate => candidate.id),
      ranked.map(candidate => ({ libraryId: candidate.id, eligible: candidate.eligible, indexed: candidate.eligible,
        items: candidate.items.slice(0, 3).map(item => ({ description: corpus.texts.get(item.hash), similarity: item.similarity,
          sharedAcrossCandidates: ranked.some(other => other.id !== candidate.id && item.libraryIds.has(other.id)) })) }))) : null;
    const byId = new Map(unprotected.map(candidate => [candidate.id, candidate]));
    const ordered = protectedIds ? protectedIds.map(id => byId.get(id)) : unprotected;
    const shortlist = ordered.slice(0, 3);
    const offset = caseIndex % Math.max(1, shortlist.length);
    const candidates = [...shortlist.slice(offset), ...shortlist.slice(0, offset)];
    const conflictEvidence = includeConflictEvidence ? candidates.map(candidate => {
      const relativeFit = Number(scoreInventoryProfile(learned, candidate.id, snapshot.candidateMetadata?.get(doc.key)).toFixed(4));
      return { libraryId: candidate.id, eligible: candidate.eligible, indexed: candidate.eligible,
        learnedProfile: { version: INVENTORY_LEARNED_PROFILE_VERSION, relativeFit,
          statusId: relativeFit === 0 ? 'neutral' : 'available', trainingDescriptions: learned.summary.trainingDescriptions },
        items: candidate.items.slice(0, 3).map(item => ({ description: corpus.texts.get(item.hash), similarity: item.similarity,
          sharedAcrossCandidates: candidates.some(other => other.id !== candidate.id && item.libraryIds.has(other.id)) })) };
    }) : undefined;
    return { overview: corpus.texts.get(doc.hash), mediaType: doc.type, observedLibraryIds: doc.libraryIds, candidates,
      ...(includeConflictEvidence ? { conflictEvidence } : {}),
      ...(preserveDescriptionCandidate ? { unprotectedCandidateIds: unprotected.slice(0, 3).map(candidate => candidate.id) } : {}),
      ...(plan ? { foldIndex } : {}),
      ...(includeContrastiveVectors || includeComparisonEvidence || includeConflictEvidence ? { descriptionHash: doc.hash, heldDescriptionHashes: plan?.held[foldIndex] } : {}),
      investigationCandidates: ordered, itemIdentity: { mediaType: doc.type, tmdbId: doc.id },
      ...(usesMetadata ? { descriptionOnlyCandidateIds: ranked.slice(0, 3).map(candidate => candidate.id) } : {}) };
  });
  // Fingerprint includes vector values and names; never print individual content hashes.
  const fingerprintHash = createHash('sha256').update(JSON.stringify({
    documents: [...corpus.documents].sort((a, b) => compare(a.key, b.key)).map(doc => ({ ...doc, libraryIds: [...doc.libraryIds].sort((a, b) => a - b) })),
    libraries: [...libraries].sort((a, b) => a.id - b.id),
  }));
  for (const [hash, vector] of [...rawVectors].sort(([a], [b]) => compare(a, b))) fingerprintHash.update(JSON.stringify([hash, vector]));
  if (usesMetadata) fingerprintHash.update(JSON.stringify([selectionVersion,
    [...(snapshot.candidateMetadata ?? new Map())].sort(([a], [b]) => compare(a, b))]));
  if (plan) fingerprintHash.update(JSON.stringify([plan.summary.protocol, plan.summary.assignmentFingerprint, priorCohortSizes]));
  return { cases, texts: corpus.texts, fingerprint: fingerprintHash.digest('hex'), sampleFingerprint: digest(JSON.stringify(sample.map(doc => doc.key))),
    ...(includeContrastiveVectors ? { vectors } : {}),
    ...(includeComparisonEvidence ? { snapshotComponents: describeInventorySnapshotDigests(snapshot, rawVectors) } : {}),
    ...(learnedProfiles ? { profileLearning: plan ? { version: INVENTORY_LEARNED_PROFILE_VERSION,
      folds: contexts.map((context, index) => ({ fold: index + 1, ...context.learned.summary })) } : contexts[0].learned.summary } : {}),
    ...(plan ? { libraryStrata: [...libraries].sort((a, b) => a.id - b.id).map((library, index) => ({ id: library.id, stratum: index + 1 })),
      excludedPriorDescriptions: excluded.size, evaluation: { ...plan.summary,
      priorCohortSizes, priorSampleFingerprints, priorItemsAvailableForTraining: true,
      previousSampleOverlap: sample.filter(doc => excluded.has(doc.hash)).length,
      sampledMedia: { movie: sample.filter(doc => doc.type === 'movie').length, tv: sample.filter(doc => doc.type === 'tv').length },
      librariesWithoutNewSamples: plan.summary.libraryCoverage.filter(row => row.sampledDescriptions === 0).length } } : {}),
    ...(usesMetadata ? { metadataSelection: { version: selectionVersion,
      ...(preserveDescriptionCandidate ? { descriptionAnchor: summarizeDescriptionAnchorSelection(cases, libraries) } : {}),
      missingQueryMetadata: sample.filter(doc => !snapshot.candidateMetadata?.get(doc.key) ||
        (!snapshot.candidateMetadata.get(doc.key).genres.length && !snapshot.candidateMetadata.get(doc.key).studio &&
          (!learnedProfiles || !snapshot.candidateMetadata.get(doc.key).rating))).length,
      changedShortlists: cases.filter(entry => entry.candidates.some(candidate => !entry.descriptionOnlyCandidateIds.includes(candidate.id))).length,
      recoveredObservedDestinations: cases.filter(entry => !entry.observedLibraryIds.some(id => entry.descriptionOnlyCandidateIds.includes(id)) &&
        entry.candidates.some(candidate => entry.observedLibraryIds.includes(candidate.id))).length,
      newObservedDestinationMisses: cases.filter(entry => entry.observedLibraryIds.some(id => entry.descriptionOnlyCandidateIds.includes(id)) &&
        !entry.candidates.some(candidate => entry.observedLibraryIds.includes(candidate.id))).length,
      descriptionOnlyPlacementMisses: cases.filter(entry => !entry.observedLibraryIds.some(id => entry.descriptionOnlyCandidateIds.includes(id))).length } } : {}),
    coverage: corpus.coverage, strata: new Set(sample.flatMap(doc => doc.libraryIds.map(id => `${doc.type}:${id}`))).size };
}
