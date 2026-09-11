/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { INVENTORY_DESCRIPTION_PROJECTION_VERSION } from './inventoryDescriptionProjection.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { buildInventoryDescriptionRetrievalReport } from './inventoryDescriptionRetrievalReport.mjs';

export function validateDescriptionRetrievalBudget(value = 512) {
  if (!Number.isInteger(value) || value < 1 || value > 10000) throw new Error('inventory_description_budget_invalid');
  return value;
}

/** One shadow build per database; no transaction remains open during inference. */
export async function runExclusiveInventoryDescriptionRetrieval({ withSessionAdvisoryLock, retrieval }, options, settings) {
  let report;
  const acquired = await withSessionAdvisoryLock(0x49445247, async () => {
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
      const identity = await embedder.inspect({ signal: inferenceSignal });
      validateDescriptionRepresentation(identity);
      if (identity.model !== embedder.model || identity.provider !== embedder.provider) throw new Error('inventory_description_provider_changed');
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
      async function verifyIdentity() {
        inferenceSignal.throwIfAborted();
        const current = await embedder.inspect({ signal: inferenceSignal });
        if (current.provider !== identity.provider || current.model !== identity.model ||
            current.digest !== identity.digest || current.dimensions !== identity.dimensions) throw new Error('inventory_description_model_changed');
      }
      for (let offset = 0; offset < work.length; offset += 8) {
        inferenceSignal.throwIfAborted();
        const batchHashes = work.slice(offset, offset + 8);
        const batch = await embedder.embedBatch(batchHashes.map(hash => snapshot.corpus.texts.get(hash)),
          { dimensions: identity.dimensions, signal: inferenceSignal });
        if (!Array.isArray(batch) || batch.length !== batchHashes.length) throw new Error('inventory_description_batch_invalid');
        // Match pgvector's float32 storage before both cold and warm scoring.
        const entries = batch.map((vector, index) => ({ hash: batchHashes[index],
          vector: validateEmbedding(vector, identity.dimensions).map(Math.fround) }));
        await verifyIdentity();
        // Persist only a verified completed batch. A later failure can resume it.
        await cache.write(identity, entries);
        entries.forEach(({ hash, vector }) => vectors.set(hash, vector));
        report.embeddedDescriptions += entries.length;
        onProgress({ embeddedDescriptions: report.embeddedDescriptions, cacheHits: report.cacheHits,
          remainingDescriptions: hashes.length - vectors.size });
      }
      await verifyIdentity();
      report.remainingDescriptions = hashes.length - vectors.size;
      const representation = { provider: identity.provider, model: identity.model, modelDigest: identity.digest, dimensions: identity.dimensions };
      if (report.remainingDescriptions) return { ...report, ...representation, status: 'warming_cache' };
      inferenceSignal.throwIfAborted();
      const comparison = buildInventoryDescriptionRetrievalReport(snapshot, vectors, identity.dimensions);
      return { ...report, ...representation, status: comparison.compared ? 'complete' : 'no_comparable_queries', comparison };
    },
  };
}
