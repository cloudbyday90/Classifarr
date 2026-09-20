/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSelection.mjs';
import { inspectDescriptionRepresentation, verifyDescriptionRepresentation } from './inventoryDescriptionBatchWriter.mjs';
import { loadFreshInventoryPolicyRuntime, describeFreshPolicySnapshot } from './freshInventoryPolicyRuntime.mjs';
import { evaluateFreshInventoryPolicyCase } from './freshInventoryPolicyPreparation.mjs';
import { buildPolicyCandidateAdjudicationPool } from './policyCandidateAdjudicationContract.mjs';
import { assessInventoryLeaderChallenge } from './inventoryLeaderChallenge.mjs';
import { prepareLeaderChallengeEvidence } from './inventoryLeaderChallengeEvidence.mjs';
import { buildLeaderChallengeReport } from './inventoryLeaderChallengeReport.mjs';
import { DiscoveryDeferredError } from './inventoryDiscoveryAdmission.mjs';
import { applyLeaderChallengeAcceptance, leaderChallengeNomination } from './inventoryLeaderChallengeAcceptance.mjs';
import { buildNeighborReferenceReport } from './inventoryNeighborReferenceReport.mjs';

/** Compare frozen policy leaders with content challengers; no model generation or domain writers. */
export async function runInventoryLeaderChallengeBenchmark(settings, {
  loadRuntime = loadFreshInventoryPolicyRuntime, signal, onProgress = () => {},
} = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  if (!options.folds || options.generateCases) throw new Error('leader_challenge_requires_grouped_zero_generation');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  const runtime = await loadRuntime({ includeTrainingProvenance: true });
  try {
    return await runtime.withDiscoveryAdmission(async (signal, checkpoint) => {
      const representation = await inspectDescriptionRepresentation(runtime.embedder, signal);
      const source = await runtime.repository.read(representation);
      if (source.config?.rag_enabled !== true || JSON.stringify(source.config) !== JSON.stringify(runtime.config)) {
        throw new Error('leader_challenge_configuration_unavailable');
      }
      await verifyDescriptionRepresentation(runtime.embedder, representation, signal);
      const components = describeFreshPolicySnapshot(source);
      const prepared = await prepareLeaderChallengeEvidence(source, representation, options, { signal, checkpoint });
      const rows = [], acceptedRows = [], crossFitRows = [], representativeRows = [], referenceRows = [];
      for (const doc of prepared.sample) {
        const entry = await prepared.forDocument(doc);
        const { common, runtime: evidence } = await evaluateFreshInventoryPolicyCase(entry, source, prepared.evidence, signal);
        const input = { policyResult: common.policyResult, libraries: source.libraries, mediaType: doc.type };
        const pool = buildPolicyCandidateAdjudicationPool(input);
        const retrieved = evidence && pool.length >= 2 && pool.length <= 64
          ? await evidence.retrieve({ contract: { valid: true, candidates: pool } }) : null;
        const assessment = evidence ? assessInventoryLeaderChallenge({ ...input, evidence: retrieved })
          : { statusId: 'metadata_unavailable', policyLeaderId: null, challengerId: null, poolSize: 0, candidateOrder: [] };
        const calibration = leaderChallengeNomination(assessment)?.statusId === 'challenger'
          ? await prepared.calibrate(entry, { signal }) : null;
        checkpoint(); signal.throwIfAborted();
        const row = { assessment, observed: doc.libraryIds, mediaType: doc.type, retainedHistory: source.trainingExclusions.has(doc.key) };
        rows.push(row);
        acceptedRows.push({ ...row, assessment: applyLeaderChallengeAcceptance(assessment, calibration) });
        crossFitRows.push({ ...row, assessment: applyLeaderChallengeAcceptance(assessment,
          { match: calibration?.crossFitMatch, neighbor: calibration?.neighbor }, { crossFit: true }) });
        representativeRows.push({ ...row, assessment: applyLeaderChallengeAcceptance(assessment,
          { match: calibration?.crossFitMatch, neighbor: calibration?.representativeNeighbor }, { crossFit: true, representative: true }) });
        if (calibration) referenceRows.push({ mediaType: doc.type, ordered: calibration.neighbor.referenceCoverage ?? [],
          representative: calibration.representativeNeighbor.referenceCoverage ?? [] });
        onProgress({ stage: 'leader_challenge_comparison', completed: rows.length, requested: prepared.sample.length });
      }
      signal.throwIfAborted();
      const current = await runtime.repository.read(representation);
      await verifyDescriptionRepresentation(runtime.embedder, representation, signal);
      const latest = describeFreshPolicySnapshot(current);
      const changedComponents = [...new Set([...Object.keys(components), ...Object.keys(latest)])]
        .filter(key => latest[key] !== components[key]).sort();
      signal.throwIfAborted();
      const comparison = buildLeaderChallengeReport(rows, source.libraries);
      return { protocol: 'inventory_leader_challenge_v4', status: changedComponents.length ? 'invalidated'
        : comparison.statuses.metadata_unavailable ? 'completed_with_errors' : 'complete',
        sourceVerified: !changedComponents.length, changedComponents, sourceComponents: components,
        sampleFingerprint: prepared.sampleFingerprint, sampleShortfall: options.size - rows.length,
        evaluation: prepared.evaluation, training: prepared.training, comparison,
        acceptanceComparison: buildLeaderChallengeReport(acceptedRows, source.libraries),
        crossFitAcceptanceComparison: buildLeaderChallengeReport(crossFitRows, source.libraries),
        representativeAcceptanceComparison: buildLeaderChallengeReport(representativeRows, source.libraries),
        referenceCoverage: buildNeighborReferenceReport(referenceRows, source.libraries),
        embedding: { model: representation.model, digest: representation.digest, dimensions: representation.dimensions },
        calls: 0, liveRoutingChanged: false, livePromotionAllowed: false,
        routingReceiptsCreated: 0, independentLabels: 0, accuracy: null, provenanceComplete: false,
        metric: 'held_out_placement_agreement_not_verified_accuracy', unknownContentRejectionAssessed: false };
    }, { signal: abort });
  } catch (error) {
    if (error instanceof DiscoveryDeferredError) return { protocol: 'inventory_leader_challenge_v4', status: 'deferred',
      reason: error.reason, sourceVerified: false, calls: 0, liveRoutingChanged: false, livePromotionAllowed: false };
    throw error;
  } finally { await runtime.close(); }
}
