/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { normalizeDescriptionVector, descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function validateDescriptionBenchmarkOptions({ seed, size = 100, generateCases = 0, context = 32768, maxMinutes = 20 } = {}) {
  if (typeof seed !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(seed) ||
      !Number.isInteger(size) || size < 1 || size > 100 ||
      !Number.isInteger(generateCases) || generateCases < 0 || generateCases > size ||
      ![8192, 16384, 32768, 65536].includes(context) ||
      !Number.isInteger(maxMinutes) || maxMinutes < 1 || maxMinutes > 120) {
    throw new Error('description_benchmark_options_invalid');
  }
  return { seed, size, generateCases, context, maxMinutes };
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
export function prepareDescriptionBenchmark(snapshot, rawVectors, dimensions, options) {
  const { corpus, libraries } = snapshot;
  if (corpus.texts.size * dimensions > 20_000_000) throw new Error('description_benchmark_vector_budget');
  const vectors = new Map([...corpus.texts.keys()].map(hash => [hash, normalizeDescriptionVector(rawVectors.get(hash), dimensions)]));
  const sample = selectDescriptionBenchmarkSample(corpus, options);
  const held = new Set(sample.map(doc => doc.hash));
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
    const shortlist = ranked.slice(0, 3);
    const offset = caseIndex % Math.max(1, shortlist.length);
    const candidates = [...shortlist.slice(offset), ...shortlist.slice(0, offset)];
    return { overview: corpus.texts.get(doc.hash), mediaType: doc.type, observedLibraryIds: doc.libraryIds, candidates,
      investigationCandidates: ranked, itemIdentity: { mediaType: doc.type, tmdbId: doc.id } };
  });
  // Fingerprint includes vector values and names; never print individual content hashes.
  const fingerprintHash = createHash('sha256').update(JSON.stringify({
    documents: [...corpus.documents].sort((a, b) => compare(a.key, b.key)).map(doc => ({ ...doc, libraryIds: [...doc.libraryIds].sort((a, b) => a - b) })),
    libraries: [...libraries].sort((a, b) => a.id - b.id),
  }));
  for (const [hash, vector] of [...rawVectors].sort(([a], [b]) => compare(a, b))) fingerprintHash.update(JSON.stringify([hash, vector]));
  return { cases, texts: corpus.texts, fingerprint: fingerprintHash.digest('hex'), sampleFingerprint: digest(JSON.stringify(sample.map(doc => doc.key))),
    coverage: corpus.coverage, strata: new Set(sample.flatMap(doc => doc.libraryIds.map(id => `${doc.type}:${id}`))).size };
}
