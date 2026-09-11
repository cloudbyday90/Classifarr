/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { buildInventorySemanticSampleReport, rankInventorySemanticLibraries } from './inventorySemanticSampleReport.mjs';
import { INVENTORY_DESCRIPTION_PROJECTION_VERSION, prepareInventoryDescriptionComparison } from './inventoryDescriptionProjection.mjs';

function normalize(vector, dimensions) {
  validateEmbedding(vector, dimensions);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map(value => value / norm);
}

function similarity(a, b) {
  return Math.max(-1, Math.min(1, a.reduce((sum, value, index) => sum + value * b[index], 0)));
}

function winner(entry) {
  const scores = rankInventorySemanticLibraries(entry.libraries);
  return scores.length < 2 || Math.abs(scores[0].score - scores[1].score) <= 1e-9 ? null : scores[0].libraryId;
}

export function createInventoryDescriptionComparison({ sampler, embedder }) {
  if (typeof sampler?.sample !== 'function' || typeof embedder?.inspect !== 'function' ||
      typeof embedder?.embedBatch !== 'function') throw new Error('description_comparison_dependencies_required');
  return {
    async compare(options = {}, { signal } = {}) {
      signal?.throwIfAborted();
      // Finish the database snapshot before spending any time on inference.
      const sample = await sampler.sample(options);
      signal?.throwIfAborted();
      const plan = prepareInventoryDescriptionComparison(sample.cases, embedder);
      const report = {
        version: 'inventory_description_comparison.v1',
        status: plan.paired.length ? 'complete' : 'no_paired_cases',
        projection: INVENTORY_DESCRIPTION_PROJECTION_VERSION,
        experiment: 'fixed_neighbors_not_full_corpus_retrieval',
        historicalRevisionParity: 'unknown',
        sampled: sample.cases.length, paired: plan.paired.length,
        excluded: plan.exclusions, uniqueDescriptions: plan.texts.length,
        shortenedDescriptionOccurrences: plan.shortenedOccurrences,
        embeddingBatches: 0, changedWinners: 0, newTies: 0, resolvedTies: 0,
        independentLabels: 0, accuracy: null,
        storedBaseline: sample.report,
      };
      if (!plan.paired.length) return report;
      const inferenceSignal = AbortSignal.any([AbortSignal.timeout(600_000), ...(signal ? [signal] : [])]);
      const before = await embedder.inspect({ signal: inferenceSignal });
      if (before?.provider !== embedder.provider || before?.model !== embedder.model ||
          typeof before?.digest !== 'string' || !/^[a-f0-9]{64}$/.test(before.digest)) {
        throw new Error('description_embedding_identity_invalid');
      }
      const vectors = [];
      for (let offset = 0; offset < plan.texts.length; offset += 8) {
        inferenceSignal.throwIfAborted();
        const texts = plan.texts.slice(offset, offset + 8);
        const batch = await embedder.embedBatch(texts, { dimensions: plan.dimensions, signal: inferenceSignal });
        if (!Array.isArray(batch) || batch.length !== texts.length) throw new Error('description_embedding_cardinality_changed');
        vectors.push(...batch.map(vector => normalize(vector, plan.dimensions)));
        report.embeddingBatches++;
      }
      const after = await embedder.inspect({ signal: inferenceSignal });
      if (before.digest !== after.digest || before.model !== after.model || before.provider !== after.provider) {
        throw new Error('description_embedding_model_changed');
      }
      inferenceSignal.throwIfAborted();
      const descriptionCases = plan.paired.map(entry => ({
        ...entry, libraries: entry.libraries.map(library => ({
          ...library, neighbors: library.neighbors.map(neighbor => ({
            ...neighbor, similarity: similarity(vectors[entry.queryIndex], vectors[neighbor.documentIndex]),
          })),
        })),
      }));
      for (let index = 0; index < plan.paired.length; index++) {
        const oldWinner = winner(plan.paired[index]);
        const newWinner = winner(descriptionCases[index]);
        report.changedWinners += Number(oldWinner !== null && newWinner !== null && oldWinner !== newWinner);
        report.newTies += Number(oldWinner !== null && newWinner === null);
        report.resolvedTies += Number(oldWinner === null && newWinner !== null);
      }
      const context = { requested: plan.paired.length, libraryCount: sample.report.activeLibraries };
      return {
        ...report,
        provider: before.provider, model: before.model, modelDigest: before.digest,
        dimensions: plan.dimensions,
        pairedStored: buildInventorySemanticSampleReport(plan.paired, context).summary,
        pairedDescriptionOnly: buildInventorySemanticSampleReport(descriptionCases, context).summary,
        strata: Object.fromEntries(Object.keys(sample.report.strata).map(stratum => [stratum, {
          paired: plan.paired.filter(entry => entry.item.stratum === stratum).length,
          changedWinners: plan.paired.reduce((count, entry, index) => count + Number(
            entry.item.stratum === stratum && winner(entry) !== null && winner(descriptionCases[index]) !== null &&
            winner(entry) !== winner(descriptionCases[index])), 0),
        }])),
      };
    },
  };
}
