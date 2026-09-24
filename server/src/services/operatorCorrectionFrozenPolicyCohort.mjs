/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateDescriptionBenchmarkOptions, prepareDescriptionBenchmark } from './inventoryDescriptionBenchmarkSample.mjs';
import { inspectDescriptionRepresentation, verifyDescriptionRepresentation } from './inventoryDescriptionBatchWriter.mjs';
import { loadFreshInventoryPolicyRuntime } from './freshInventoryPolicyRuntime.mjs';
import { createFreshInventoryPolicyEvidence } from './freshInventoryPolicyEvidence.mjs';
import { prepareOperatorCorrectionFreshPolicySource } from './operatorCorrectionFreshPolicyEvaluation.mjs';
import { captureOperatorCorrectionFrozenPolicyInput } from './operatorCorrectionFrozenPolicyCapture.mjs';

/** No generation or writer is available: one read snapshot supplies both paired scorers. */
export async function captureOperatorCorrectionFrozenPolicyCohort(settings, {
  loadRuntime = loadFreshInventoryPolicyRuntime, signal,
  inspectRepresentation = inspectDescriptionRepresentation,
  verifyRepresentation = verifyDescriptionRepresentation,
  prepareCorrections = prepareOperatorCorrectionFreshPolicySource,
  prepareSample = prepareDescriptionBenchmark,
  createEvidence = createFreshInventoryPolicyEvidence,
  captureInput = captureOperatorCorrectionFrozenPolicyInput,
} = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  if (!options.folds) throw new Error('frozen_policy_grouped_folds_required');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  const runtime = await loadRuntime({ includeOperatorCorrectionLabels: true, repeatableRead: true });
  try {
    abort.throwIfAborted();
    const representation = await inspectRepresentation(runtime.embedder, abort);
    const source = await runtime.repository.read(representation);
    await verifyRepresentation(runtime.embedder, representation, abort);
    const correctionCohort = prepareCorrections(source);
    const prepared = prepareSample(correctionCohort.source, source.vectors,
      representation.dimensions, options, { learnedProfiles: true, includeComparisonEvidence: true,
        preserveDescriptionCandidate: true, eligibleSampleKeys: correctionCohort.eligibleSampleKeys });
    if (!prepared.cases.length) throw new Error('frozen_policy_no_eligible_corrections');
    const evidence = createEvidence(correctionCohort.source, prepared);
    const input = captureInput({ source, prepared, correctionCohort, evidence });
    abort.throwIfAborted();
    const current = await runtime.repository.read(representation);
    if (current.fingerprint !== source.fingerprint) throw new Error('frozen_policy_source_changed');
    await verifyRepresentation(runtime.embedder, representation, abort);
    abort.throwIfAborted();
    return input;
  } finally { await runtime.close(); }
}
