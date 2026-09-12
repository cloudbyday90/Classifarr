/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSelection.mjs';
import { compareInventoryDescription, isValidDescriptionComparison, summarizeDescriptionComparisons } from './inventoryDescriptionBenchmarkComparison.mjs';
import { summarizeContentFirstPairs, summarizeContentFirstStrata } from './inventoryContentFirstReport.mjs';
import { resolveInventoryEvidenceConflict, selectInventoryConflictResult } from './inventoryEvidenceConflictRecheck.mjs';
import { summarizeSelectiveInventoryRecheck } from './inventorySelectiveRecheckReport.mjs';

function validateScope(prepared, options) {
  if (!options.folds || prepared.evaluation?.folds !== options.folds || !Array.isArray(prepared.libraryStrata) ||
      !Array.isArray(prepared.cases) || prepared.cases.length > options.size || !(prepared.texts instanceof Map)) {
    throw new Error('content_first_comparison_scope_invalid');
  }
  const validId = id => Number.isInteger(id) && id > 0 && id <= 2147483647;
  const libraryIds = new Set(prepared.libraryStrata.map(library => library?.id));
  if (libraryIds.size !== prepared.libraryStrata.length || libraryIds.size < 2 || libraryIds.size > 64 ||
      ![...libraryIds].every(validId) || new Set(prepared.libraryStrata.map(library => library.stratum)).size !== libraryIds.size ||
      prepared.libraryStrata.some(library => !Number.isInteger(library.stratum) || library.stratum < 1 || library.stratum > 64)) {
    throw new Error('content_first_comparison_scope_invalid');
  }
  for (const entry of prepared.cases) {
    if (!['movie', 'tv'].includes(entry.mediaType) || !/^[a-f0-9]{64}$/.test(entry.descriptionHash) ||
        !Number.isInteger(entry.foldIndex) || entry.foldIndex < 0 || entry.foldIndex >= options.folds ||
        typeof entry.overview !== 'string' || prepared.texts.get(entry.descriptionHash) !== entry.overview ||
        !(entry.heldDescriptionHashes instanceof Set) || !entry.heldDescriptionHashes.has(entry.descriptionHash) ||
        !Array.isArray(entry.observedLibraryIds) || !entry.observedLibraryIds.length ||
        !entry.observedLibraryIds.every(id => validId(id) && libraryIds.has(id)) ||
        !Array.isArray(entry.candidates) || entry.candidates.length < 2 || entry.candidates.length > 3 ||
        new Set(entry.candidates.map(candidate => candidate?.id)).size !== entry.candidates.length ||
        entry.candidates.some(candidate => !validId(candidate?.id) || !libraryIds.has(candidate.id) || candidate.media_type !== entry.mediaType ||
          !Array.isArray(candidate.items) || candidate.items.length > 100 || candidate.items.some(item =>
            !/^[a-f0-9]{64}$/.test(item?.hash) || entry.heldDescriptionHashes.has(item.hash) ||
            typeof prepared.texts.get(item.hash) !== 'string' || !(item.libraryIds instanceof Set) || !item.libraryIds.has(candidate.id)))) {
      throw new Error('content_first_comparison_evidence_invalid');
    }
  }
}

/** Paired or content-triggered comparisons; observed outcomes never select an arm. */
export async function runContentFirstInventoryComparison(prepared, settings,
  { client, identity, signal, onProgress = () => {}, selectiveRecheck = false } = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  validateScope(prepared, options);
  if (selectiveRecheck && (!prepared.profileLearning || prepared.cases.some(entry =>
    !Array.isArray(entry.conflictEvidence) || entry.conflictEvidence.length !== entry.candidates.length ||
    entry.conflictEvidence.some((evidence, index) => evidence?.libraryId !== entry.candidates[index].id)))) {
    throw new Error('selective_recheck_evidence_scope_invalid');
  }
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  const requested = Math.min(options.generateCases, prepared.cases.length);
  const pairs = [], arms = { named: [], anonymous: [] }, decisions = [];
  let calls = 0;
  for (let index = 0; index < requested && !abort.aborted; index++) {
    const pair = {};
    pairs.push(pair);
    for (const arm of !selectiveRecheck && index % 2 ? ['anonymous', 'named'] : ['named', 'anonymous']) {
      if (abort.aborted) break;
      let decision;
      if (selectiveRecheck && arm === 'anonymous') {
        decision = resolveInventoryEvidenceConflict({
          proposedLibraryId: pair.named.status === 'proposed' ? pair.named.destinationId : null,
          candidates: prepared.cases[index].conflictEvidence,
        });
        decisions.push(decision);
        if (!decision.shouldRecheck) { pair.anonymous = pair.named; break; }
      }
      const result = await compareInventoryDescription(prepared.cases[index], prepared.texts, {
        client, identity, context: options.context, signal: abort, anonymousLibraries: arm === 'anonymous', onCall: () => calls++,
      });
      pair[arm] = decision ? (abort.aborted ? pair.named : selectInventoryConflictResult(pair.named, result, decision)) : result;
      arms[arm].push(result);
      if (!selectiveRecheck) onProgress({ stage: 'paired_comparison', completedCalls: calls, maximumCalls: requested * 2,
        completedPairs: pairs.filter(value => value.named && value.anonymous).length, requested });
    }
    if (selectiveRecheck) onProgress({ stage: 'selective_recheck', completedCalls: calls, maximumCalls: requested * 2,
      completedPairs: pairs.filter(value => value.named && value.anonymous).length, requested });
  }
  const results = Object.values(arms).flat();
  return { version: 1, protocol: selectiveRecheck ? 'selective_inventory_recheck_v1' : 'content_first_library_comparison_v1',
    status: options.generateCases === 0 ? 'preflight' : abort.aborted ? 'interrupted'
      : results.some(result => !isValidDescriptionComparison(result)) ? 'completed_with_errors' : 'complete',
    seed: options.seed, snapshotFingerprint: prepared.fingerprint, snapshotComponents: prepared.snapshotComponents,
    sampleFingerprint: prepared.sampleFingerprint, requestedTitles: options.size, sampledTitles: prepared.cases.length,
    sampleShortfall: Math.max(0, options.size - prepared.cases.length), excludedPriorDescriptions: prepared.excludedPriorDescriptions ?? 0,
    evaluation: prepared.evaluation, metadataSelection: prepared.metadataSelection, profileLearning: prepared.profileLearning,
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false, liveRoutingChanged: false,
    verifiedLabelsCreated: 0, userQuestionsCreated: 0, inputTruncation: 'unknown',
    generation: identity ? { model: identity.model, digest: identity.digest, context: options.context, temperature: 0, seed: 42, thinking: false, outputLimit: 64 } : null,
    requestedGenerationCases: options.generateCases, availableGenerationCases: requested, calls, maximumCalls: requested * 2,
    arms: Object.entries(arms).map(([id, values]) => ({ id, examples: 9, ...summarizeDescriptionComparisons(values) })),
    ...(selectiveRecheck ? summarizeSelectiveInventoryRecheck(prepared, pairs, requested, decisions)
      : { paired: summarizeContentFirstPairs(pairs, requested), strata: summarizeContentFirstStrata(prepared, pairs, requested) }) };
}
