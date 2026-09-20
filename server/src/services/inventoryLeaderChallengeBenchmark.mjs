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
import { evaluateNeighborIntegrityControls, summarizeNeighborIntegrityControls } from './inventoryNeighborIntegrityControls.mjs';
import { assessLibraryWithheldProbe, buildLibraryWithheldProbeReport } from './inventoryLibraryWithheldProbes.mjs';
import { createLeaderSemanticEvaluation, LEADER_SEMANTIC_MAX_CASES } from './inventoryLeaderSemanticEvaluation.mjs';

/** Compare frozen policy leaders; optional local semantic evaluation has no domain writers. */
export async function runInventoryLeaderChallengeBenchmark(settings, {
  loadRuntime = loadFreshInventoryPolicyRuntime, signal, onProgress = () => {}, semantic = false,
} = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  if (typeof semantic !== 'boolean' || !options.folds || (!semantic && options.generateCases) ||
      (semantic && options.generateCases > LEADER_SEMANTIC_MAX_CASES)) throw new Error('leader_challenge_requires_grouped_zero_generation_or_bounded_semantics');
  const protocol = semantic ? 'inventory_leader_semantic_v1' : 'inventory_leader_challenge_v6';
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  const runtime = await loadRuntime({ includeTrainingProvenance: true });
  let generationCalls = 0;
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
      const rows = [], acceptedRows = [], crossFitRows = [], representativeRows = [], referenceRows = [], exactRows = [];
      const semanticEvaluation = semantic ? createLeaderSemanticEvaluation(options) : null;
      let exactNeighborResources = null;
      const integrityRows = [], withheldRows = [];
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
        exactRows.push({ ...row, assessment: applyLeaderChallengeAcceptance(assessment,
          { match: calibration?.crossFitMatch, neighbor: calibration?.exactNeighbor }, { crossFit: true, exact: true, expectedContextId: calibration?.contextId }) });
        if (semanticEvaluation && exactRows.at(-1).assessment.acceptance.reason === 'not_distinguished') {
          semanticEvaluation.add({ kind: 'ambiguous_nomination', contextId: calibration.contextId, metadata: evidence.metadata,
            candidateIds: assessment.candidateOrder, evidence: retrieved, observed: doc.libraryIds,
            baselineId: assessment.policyLeaderId, vetoed: assessment.statusId === 'review_veto' });
        }
        if (calibration) integrityRows.push(...await evaluateNeighborIntegrityControls(entry, assessment, calibration, prepared.calibrate, { signal }));
        if (calibration?.exactNeighbor?.resources) exactNeighborResources = calibration.exactNeighbor.resources;
        if (calibration) referenceRows.push({ mediaType: doc.type, ordered: calibration.neighbor.referenceCoverage ?? [],
          representative: calibration.representativeNeighbor.referenceCoverage ?? [] });
        onProgress({ stage: 'leader_challenge_comparison', completed: rows.length, requested: prepared.sample.length });
      }
      for (const { doc, omittedLibraryId } of prepared.withheldLibraryProbes) {
        const entry = await prepared.forDocument(doc);
        const calibration = await prepared.calibrate(entry, { signal, omittedLibraryId });
        const probe = assessLibraryWithheldProbe(calibration, omittedLibraryId);
        withheldRows.push({ mediaType: doc.type, omittedLibraryId, ...probe });
        if (semanticEvaluation && probe.status === 'supported_elsewhere') {
          const evidence = prepared.evidence.forCase(entry), candidateIds = calibration.crossFitMatch.candidates.map(row => row.libraryId);
          const retrieved = await evidence?.retrieve({ contract: { valid: true,
            candidates: candidateIds.map(libraryId => ({ libraryId, mediaType: doc.type })) } });
          semanticEvaluation.add({ kind: 'withheld_library', contextId: calibration.contextId, metadata: evidence?.metadata,
            candidateIds, evidence: retrieved, observed: [], baselineId: null });
        }
        if (calibration.exactNeighbor.resources) exactNeighborResources = calibration.exactNeighbor.resources;
        checkpoint(); signal.throwIfAborted();
        onProgress({ stage: 'library_withheld_probes', completed: withheldRows.length, requested: prepared.withheldLibraryProbes.length });
      }
      const integrityControls = summarizeNeighborIntegrityControls(integrityRows);
      if (semanticEvaluation && integrityControls.status === 'failed') throw new Error('leader_semantic_integrity_controls_failed');
      const semanticComparison = semanticEvaluation ? await semanticEvaluation.run({ createClient: runtime.createClient, signal, checkpoint, onProgress,
        onGenerationCall: () => { generationCalls++; } }) : null;
      signal.throwIfAborted();
      const current = await runtime.repository.read(representation);
      await verifyDescriptionRepresentation(runtime.embedder, representation, signal);
      const latest = describeFreshPolicySnapshot(current);
      const changedComponents = [...new Set([...Object.keys(components), ...Object.keys(latest)])]
        .filter(key => latest[key] !== components[key]).sort();
      signal.throwIfAborted();
      const comparison = buildLeaderChallengeReport(rows, source.libraries);
      return { protocol, status: changedComponents.length ? 'invalidated'
        : comparison.statuses.metadata_unavailable || integrityControls.status === 'failed' || semanticComparison?.status === 'completed_with_errors'
          ? 'completed_with_errors' : 'complete',
        sourceVerified: !changedComponents.length, changedComponents, sourceComponents: components,
        sampleFingerprint: prepared.sampleFingerprint, sampleShortfall: options.size - rows.length,
        evaluation: prepared.evaluation, training: prepared.training, comparison,
        acceptanceComparison: buildLeaderChallengeReport(acceptedRows, source.libraries),
        crossFitAcceptanceComparison: buildLeaderChallengeReport(crossFitRows, source.libraries),
        representativeAcceptanceComparison: buildLeaderChallengeReport(representativeRows, source.libraries),
        exactAcceptanceComparison: buildLeaderChallengeReport(exactRows, source.libraries), exactNeighborResources,
        integrityControls, withheldLibraryProbes: buildLibraryWithheldProbeReport(withheldRows, source.libraries),
        ...(semanticComparison ? { semanticComparison } : {}),
        referenceCoverage: buildNeighborReferenceReport(referenceRows, source.libraries),
        embedding: { model: representation.model, digest: representation.digest, dimensions: representation.dimensions },
        calls: generationCalls, liveRoutingChanged: false, livePromotionAllowed: false,
        routingReceiptsCreated: 0, independentLabels: 0, accuracy: null, provenanceComplete: false,
        metric: 'held_out_placement_agreement_not_verified_accuracy', unknownContentRejectionAssessed: false };
    }, { signal: abort });
  } catch (error) {
    if (error instanceof DiscoveryDeferredError) return { protocol, status: 'deferred',
      reason: error.reason, sourceVerified: false, calls: generationCalls, liveRoutingChanged: false, livePromotionAllowed: false };
    throw error;
  } finally { await runtime.close(); }
}
