/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { normalizeDescriptionVector, descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';
import { rankInventoryMetadataCandidates } from './inventoryMetadataCandidates.mjs';
import { learnInventoryProfiles, rankInventoryLearnedCandidates, INVENTORY_LEARNED_PROFILE_VERSION } from './inventoryLearnedProfiles.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function validateDescriptionBenchmarkOptions({ seed, size = 100, generateCases = 0, context = 32768, maxMinutes = 20, excludePriorSize = 0 } = {}) {
  if (typeof seed !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(seed) ||
      !Number.isInteger(size) || size < 1 || size > 200 ||
      !Number.isInteger(generateCases) || generateCases < 0 || generateCases > size ||
      !Number.isInteger(excludePriorSize) || excludePriorSize < 0 || excludePriorSize > 200 ||
      ![8192, 16384, 32768, 65536].includes(context) ||
      !Number.isInteger(maxMinutes) || maxMinutes < 1 || maxMinutes > 120) {
    throw new Error('description_benchmark_options_invalid');
  }
  return { seed, size, generateCases, context, maxMinutes, excludePriorSize };
}

/** Private snapshot in; deterministic, distinct-description sample out. */
export function selectDescriptionBenchmarkSample(corpus, options) {
  const { seed, size } = validateDescriptionBenchmarkOptions(options);
  const counts = new Map();
  for (const doc of corpus.documents) for (const id of doc.libraryIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const groups = new Map();
  for (const doc of corpus.documents) {
    const library = [...doc.libraryIds].sort((a, b) => counts.get(a) - counts.get(b) || a - b)[0];
    const key = `${doc.type}:${library}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ doc, rank: digest(`${seed}:${doc.key}`) });
  }
  const ordered = [...groups].sort(([a], [b]) => compare(digest(`${seed}:${a}`), digest(`${seed}:${b}`)))
    .map(([, rows]) => rows.sort((a, b) => compare(a.rank, b.rank)));
  const sample = [], hashes = new Set();
  while (sample.length < size && ordered.some(rows => rows.length)) {
    for (const rows of ordered) {
      let entry;
      do { entry = rows.shift(); } while (entry && hashes.has(entry.doc.hash));
      if (entry) { hashes.add(entry.doc.hash); sample.push(entry.doc); }
      if (sample.length === size) break;
    }
  }
  return sample;
}

/** Freeze vectors, candidate selection and neighbor ordering for all three arms. */
export function prepareDescriptionBenchmark(snapshot, rawVectors, dimensions, options, { metadataCandidates = false, learnedProfiles = false } = {}) {
  if (metadataCandidates && learnedProfiles) throw new Error('description_benchmark_selection_mode_conflict');
  const { excludePriorSize } = validateDescriptionBenchmarkOptions(options);
  if (excludePriorSize > 0) {
    const prior = new Set(selectDescriptionBenchmarkSample(snapshot.corpus,
      { seed: options.seed, size: excludePriorSize }).map(doc => doc.hash));
    const corpus = { ...snapshot.corpus, documents: snapshot.corpus.documents.filter(doc => !prior.has(doc.hash)),
      texts: new Map([...snapshot.corpus.texts].filter(([hash]) => !prior.has(hash))) };
    return { ...prepareDescriptionBenchmark({ ...snapshot, corpus }, rawVectors, dimensions,
      { ...options, excludePriorSize: 0 }, { metadataCandidates, learnedProfiles }), excludedPriorDescriptions: prior.size };
  }
  const usesMetadata = metadataCandidates || learnedProfiles;
  const selectionVersion = learnedProfiles ? INVENTORY_LEARNED_PROFILE_VERSION : 'metadata_rrf_v1';
  const { corpus, libraries } = snapshot;
  if (corpus.texts.size * dimensions > 20_000_000) throw new Error('description_benchmark_vector_budget');
  const vectors = new Map([...corpus.texts.keys()].map(hash => [hash, normalizeDescriptionVector(rawVectors.get(hash), dimensions)]));
  const sample = selectDescriptionBenchmarkSample(corpus, options);
  const held = new Set(sample.map(doc => doc.hash));
  const learned = learnedProfiles ? learnInventoryProfiles(corpus.documents, snapshot.candidateMetadata, libraries, held) : null;
  const metadataExamples = corpus.documents.filter(doc => !held.has(doc.hash))
    .map(doc => ({ ...doc, metadata: snapshot.candidateMetadata?.get(doc.key) }));
  const membership = new Map();
  for (const doc of corpus.documents) {
    if (held.has(doc.hash)) continue;
    const key = `${doc.type}:${doc.hash}`;
    if (!membership.has(key)) membership.set(key, { type: doc.type, hash: doc.hash, libraryIds: new Set() });
    for (const id of doc.libraryIds) membership.get(key).libraryIds.add(id);
  }
  const cases = sample.map((doc, caseIndex) => {
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
    const ordered = learned ? rankInventoryLearnedCandidates(ranked, snapshot.candidateMetadata?.get(doc.key), learned)
      : metadataCandidates ? rankInventoryMetadataCandidates(ranked, snapshot.candidateMetadata?.get(doc.key),
        metadataExamples.filter(example => example.type === doc.type)) : ranked;
    const shortlist = ordered.slice(0, 3);
    const offset = caseIndex % Math.max(1, shortlist.length);
    const candidates = [...shortlist.slice(offset), ...shortlist.slice(0, offset)];
    return { overview: corpus.texts.get(doc.hash), mediaType: doc.type, observedLibraryIds: doc.libraryIds, candidates,
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
  return { cases, texts: corpus.texts, fingerprint: fingerprintHash.digest('hex'), sampleFingerprint: digest(JSON.stringify(sample.map(doc => doc.key))),
    ...(learned ? { profileLearning: learned.summary } : {}),
    ...(usesMetadata ? { metadataSelection: { version: selectionVersion,
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
