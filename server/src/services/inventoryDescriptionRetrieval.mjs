/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { INVENTORY_DESCRIPTION_PROJECTION_VERSION } from './inventoryDescriptionProjection.mjs';
import { INVENTORY_DESCRIPTION_CACHE_LOCK, inspectDescriptionRepresentation,
  verifyDescriptionRepresentation, writeInventoryDescriptionBatch } from './inventoryDescriptionBatchWriter.mjs';
import { buildInventoryDescriptionRetrievalReport } from './inventoryDescriptionRetrievalReport.mjs';

export function validateDescriptionRetrievalBudget(value = 512) {
  if (!Number.isInteger(value) || value < 1 || value > 10000) throw new Error('inventory_description_budget_invalid');
  return value;
}

/** One shadow build per database; no transaction remains open during inference. */
export async function runExclusiveInventoryDescriptionRetrieval({ withSessionAdvisoryLock, retrieval }, options, settings) {
  let report;
  const acquired = await withSessionAdvisoryLock(INVENTORY_DESCRIPTION_CACHE_LOCK, async () => {
    report = await retrieval.run(options, settings);
  });
  return acquired ? report : { version: 'inventory_description_retrieval.v1', mode: 'shadow', status: 'already_running' };
}

export function createInventoryDescriptionRetrieval({ sampler, cache, embedder }) {
  return {
    async run(options = {}, { maxNewDescriptions = 512, signal, onProgress = () => {} } = {}) {
      validateDescriptionRetrievalBudget(maxNewDescriptions);
      signal?.throwIfAborted();
      const snapshot = await sampler.sample(options);
      signal?.throwIfAborted();
      const report = { version: 'inventory_description_retrieval.v1', mode: 'shadow',
        projection: INVENTORY_DESCRIPTION_PROJECTION_VERSION, coverage: snapshot.corpus.coverage,
        cacheHits: 0, embeddedDescriptions: 0, remainingDescriptions: 0, expiredRowsPruned: 0,
        accuracy: null, independentLabels: 0 };
      if (!snapshot.corpus.texts.size) return { ...report, status: 'empty_corpus' };
      const inferenceSignal = AbortSignal.any([AbortSignal.timeout(2_400_000), ...(signal ? [signal] : [])]);
      const identity = await inspectDescriptionRepresentation(embedder, inferenceSignal);
      if (snapshot.corpus.texts.size * identity.dimensions > 20_000_000) throw new Error('inventory_description_vector_budget_exceeded');
      const hashes = [...snapshot.corpus.texts.keys()];
      const vectors = await cache.read(identity, hashes);
      for (const [hash, vector] of vectors) {
        if (!snapshot.corpus.texts.has(hash)) throw new Error('inventory_description_cache_scope_invalid');
        vectors.set(hash, validateEmbedding(vector, identity.dimensions).map(Math.fround));
      }
      report.cacheHits = vectors.size;
      const pending = hashes.filter(hash => !vectors.has(hash));
      const work = pending.slice(0, maxNewDescriptions);
      report.expiredRowsPruned = await cache.pruneExpired();
      for (let offset = 0; offset < work.length; offset += 8) {
        inferenceSignal.throwIfAborted();
        const batchHashes = work.slice(offset, offset + 8);
        const entries = await writeInventoryDescriptionBatch({ embedder, identity, cache,
          signal: inferenceSignal, hashes: batchHashes, texts: snapshot.corpus.texts });
        entries.forEach(({ hash, vector }) => vectors.set(hash, vector));
        report.embeddedDescriptions += entries.length;
        onProgress({ embeddedDescriptions: report.embeddedDescriptions, cacheHits: report.cacheHits,
          remainingDescriptions: hashes.length - vectors.size });
      }
      await verifyDescriptionRepresentation(embedder, identity, inferenceSignal);
      report.remainingDescriptions = hashes.length - vectors.size;
      const representation = { provider: identity.provider, model: identity.model, modelDigest: identity.digest, dimensions: identity.dimensions };
      if (report.remainingDescriptions) return { ...report, ...representation, status: 'warming_cache' };
      inferenceSignal.throwIfAborted();
      const comparison = buildInventoryDescriptionRetrievalReport(snapshot, vectors, identity.dimensions);
      return { ...report, ...representation, status: comparison.compared ? 'complete' : 'no_comparable_queries', comparison };
    },
  };
}
