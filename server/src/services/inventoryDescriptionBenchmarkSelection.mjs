/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function validateDescriptionBenchmarkOptions({ seed, size = 100, generateCases = 0, context = 32768,
  maxMinutes = 20, excludePriorSize = 0, excludePriorSizes = [], folds = 0 } = {}) {
  if (typeof seed !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(seed) ||
      !Number.isInteger(size) || size < 1 || size > 300 ||
      !Number.isInteger(generateCases) || generateCases < 0 || generateCases > size ||
      !Number.isInteger(excludePriorSize) || excludePriorSize < 0 || excludePriorSize > 300 ||
      !Array.isArray(excludePriorSizes) || excludePriorSizes.length > 10 ||
      excludePriorSizes.some(value => !Number.isInteger(value) || value < 1 || value > 300) ||
      (excludePriorSize > 0 && excludePriorSizes.length > 0) ||
      ![0, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(folds) ||
      ![8192, 16384, 32768, 65536].includes(context) ||
      !Number.isInteger(maxMinutes) || maxMinutes < 1 || maxMinutes > 120) {
    throw new Error('description_benchmark_options_invalid');
  }
  return { seed, size, generateCases, context, maxMinutes, excludePriorSize, excludePriorSizes: [...excludePriorSizes], folds };
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

/** Replay prior cohorts in order; do not assume successive samples equal one larger sample. */
export function selectAdditionalDescriptionBenchmarkSample(corpus, options) {
  const validated = validateDescriptionBenchmarkOptions(options);
  const sizes = validated.excludePriorSize ? [validated.excludePriorSize] : validated.excludePriorSizes;
  const excluded = new Set();
  const priorSampleFingerprints = [];
  let remaining = corpus;
  for (const size of sizes) {
    const prior = selectDescriptionBenchmarkSample(remaining, { seed: validated.seed, size });
    priorSampleFingerprints.push(digest(JSON.stringify(prior.map(doc => doc.key))));
    for (const doc of prior) excluded.add(doc.hash);
    remaining = { ...corpus, documents: corpus.documents.filter(doc => !excluded.has(doc.hash)) };
  }
  return { sample: selectDescriptionBenchmarkSample(remaining, validated), excluded, priorCohortSizes: sizes, priorSampleFingerprints };
}
