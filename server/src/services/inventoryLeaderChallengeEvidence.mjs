/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { prepareLinearRankerSource, selectLinearRankerTraining } from './inventoryLinearRankerSource.mjs';
import { descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';
import { createFreshInventoryPolicyEvidence } from './freshInventoryPolicyEvidence.mjs';
import { createLeaderChallengeCalibration } from './inventoryLeaderChallengeCalibration.mjs';

/** Same admitted description groups support policy observations, metadata fit and nearest examples. */
export async function prepareLeaderChallengeEvidence(snapshot, representation, options, { signal, checkpoint = () => {} } = {}) {
  const { dimensions } = representation;
  const source = prepareLinearRankerSource(snapshot, dimensions);
  const selection = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options);
  const plan = planDescriptionBenchmarkFolds(snapshot.corpus, selection.sample, snapshot.libraries, options);
  const trainingByFold = new Map(), training = [];
  for (const [index, held] of plan.held.entries()) {
    const admitted = selectLinearRankerTraining(source, held);
    trainingByFold.set(index, admitted.documents);
    training.push({ fold: index + 1, ...admitted.counts });
  }
  const work = selection.sample.reduce((sum, doc) => sum + dimensions *
    trainingByFold.get(plan.foldByHash.get(doc.hash)).filter(row => row.type === doc.type).length, 0);
  // Existing source and sample limits bound this to 300 * 8 million components.
  const evidence = createFreshInventoryPolicyEvidence(snapshot, { texts: snapshot.corpus.texts }, { trainingByFold });
  return { evidence, sample: selection.sample, training,
    calibrate: createLeaderChallengeCalibration(snapshot, representation, trainingByFold),
    sampleFingerprint: createHash('sha256').update(JSON.stringify(selection.sample.map(doc => doc.key))).digest('hex'),
    evaluation: { ...plan.summary, priorCohortSizes: selection.priorCohortSizes,
      priorSampleFingerprints: selection.priorSampleFingerprints, excludedPriorDescriptions: selection.excluded.size,
      priorItemsAvailableForTraining: true, trainingCountsBeforeProvenanceExclusion: true, workComponents: work },
    async forDocument(doc) {
      await setImmediate(); checkpoint(); signal?.throwIfAborted();
      const foldIndex = plan.foldByHash.get(doc.hash), query = source.vectors.get(doc.hash);
      const scored = trainingByFold.get(foldIndex).filter(row => row.type === doc.type).map(row => ({
        hash: row.hash, libraryIds: new Set(row.libraryIds),
        similarity: descriptionCosineSimilarity(query, source.vectors.get(row.hash)),
      })).sort((a, b) => b.similarity - a.similarity || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
      const investigationCandidates = snapshot.libraries.filter(library => library.media_type === doc.type).map(library => {
        const items = scored.filter(row => row.libraryIds.has(library.id));
        return { id: library.id, eligible: items.length, items: items.slice(0, 3) };
      });
      signal?.throwIfAborted();
      return { mediaType: doc.type, itemIdentity: { tmdbId: doc.id, mediaType: doc.type }, overview: snapshot.corpus.texts.get(doc.hash),
        descriptionHash: doc.hash, heldDescriptionHashes: plan.held[foldIndex], foldIndex, investigationCandidates };
    },
  };
}
