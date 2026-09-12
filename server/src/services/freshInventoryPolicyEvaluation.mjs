/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateDescriptionBenchmarkOptions, prepareDescriptionBenchmark } from './inventoryDescriptionBenchmarkSample.mjs';
import { inspectDescriptionRepresentation, verifyDescriptionRepresentation } from './inventoryDescriptionBatchWriter.mjs';
import { loadFreshInventoryPolicyRuntime, describeFreshPolicySnapshot } from './freshInventoryPolicyRuntime.mjs';
import { createFreshInventoryPolicyEvidence } from './freshInventoryPolicyEvidence.mjs';
import { prepareFreshInventoryPolicyCase } from './freshInventoryPolicyPreparation.mjs';
import { reducePolicyShortlistReplayResponse } from './policyShortlistReplay.mjs';
import { buildFreshPolicyReport } from './freshInventoryPolicyReport.mjs';
import { createInventoryMatchCalibration } from './inventoryMatchCalibration.mjs';

/** Fresh policies, fold-local evidence, sequential admitted inference, aggregate output only. */
export async function runFreshInventoryPolicyEvaluation(settings, {
  loadRuntime = loadFreshInventoryPolicyRuntime, signal, onProgress = () => {},
  prepareCase = prepareFreshInventoryPolicyCase,
} = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  if (!options.folds) throw new Error('fresh_policy_evaluation_requires_folds');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  const runtime = await loadRuntime();
  try {
    const representation = await inspectDescriptionRepresentation(runtime.embedder, abort);
    const source = await runtime.repository.read(representation);
    if (source.config?.rag_enabled !== true || source.config.primary_provider !== 'ollama' ||
        JSON.stringify(source.config) !== JSON.stringify(runtime.config)) throw new Error('fresh_policy_configuration_unavailable');
    await verifyDescriptionRepresentation(runtime.embedder, representation, abort);
    const prepared = prepareDescriptionBenchmark(source, source.vectors, representation.dimensions, options,
      { learnedProfiles: true, includeComparisonEvidence: true, preserveDescriptionCandidate: true });
    const evidence = createFreshInventoryPolicyEvidence(source, prepared);
    const calibration = createInventoryMatchCalibration({ documents: source.corpus.documents,
      libraries: source.libraries, vectors: source.vectors, representation });
    const rows = [];
    for (const sample of prepared.cases) {
      abort.throwIfAborted();
      const matchCalibration = await calibration.assess(sample, { signal: abort });
      rows.push({ sample, prepared: { ...await prepareCase(sample, source, evidence, abort), matchCalibration } });
      onProgress({ stage: 'fresh_policy_preparation', completed: rows.length, requested: prepared.cases.length });
    }
    const initialComponents = describeFreshPolicySnapshot(source);
    let changedComponents = [];
    const verify = async ({ allowMetadataRefresh = false } = {}) => {
      abort.throwIfAborted();
      const current = await runtime.repository.read(representation);
      if (current.fingerprint !== source.fingerprint) {
        const currentComponents = describeFreshPolicySnapshot(current);
        const changed = Object.keys(initialComponents).filter(key => initialComponents[key] !== currentComponents[key]);
        changedComponents = [...new Set([...changedComponents, ...changed])].sort();
        // All prompts and fold models were frozen before generation. Background metadata
        // refresh cannot alter those inputs; it changes freshness, not snapshot validity.
        if (!allowMetadataRefresh || !changed.length || changed.some(key => !['metadata', 'observedTraits'].includes(key))) {
          throw new Error('fresh_policy_source_changed');
        }
      }
      await verifyDescriptionRepresentation(runtime.embedder, representation, abort);
    };
    // Preparation reads only the captured source. Background metadata refresh
    // cannot change those frozen inputs, including the newly fitted baselines.
    await verify({ allowMetadataRefresh: true });
    const requested = rows.slice(0, options.generateCases).filter(row => row.prepared.status === 'ready');
    const client = requested.length ? runtime.createClient() : null;
    const identity = client ? await client.inspect(abort) : null;
    let calls = 0, verificationFailure = null;
    const verifyGenerationSnapshot = async () => {
      try { await verify({ allowMetadataRefresh: true }); }
      catch (error) {
        verificationFailure = error?.message === 'fresh_policy_source_changed' ? 'source_changed' : 'snapshot_verification_failed';
      }
      onProgress({ stage: 'fresh_policy_snapshot_check', calls,
        status: verificationFailure ?? (changedComponents.length ? 'frozen_snapshot_metadata_refreshed' : 'verified') });
    };
    for (const row of requested) {
      if (abort.aborted) break;
      const entry = row.prepared;
      try {
        const generated = await client.generate({ prompt: entry.arms.protected.prompt,
          count: entry.arms.protected.contract.candidates.length, context: options.context,
          identity, signal: abort, responseContract: 'adjudication', onGenerationCall: () => calls++ });
        abort.throwIfAborted();
        row.generated = reducePolicyShortlistReplayResponse(entry, 'protected', generated, identity);
      } catch (error) {
        row.generated = { status: abort.aborted ? 'interrupted' : 'failed' };
        if (error?.message === 'description_benchmark_model_changed') verificationFailure = 'generation_model_changed';
      }
      onProgress({ stage: 'fresh_policy_generation', completed: rows.filter(value => value.generated).length, requested: requested.length, calls });
      if (verificationFailure) break;
      if (calls && calls % 25 === 0 && !abort.aborted) {
        await verifyGenerationSnapshot();
        if (verificationFailure) break;
      }
    }
    if (!abort.aborted && !verificationFailure) await verifyGenerationSnapshot();
    return buildFreshPolicyReport({ source, prepared, rows, options, calls, identity, representation,
      interrupted: abort.aborted, verificationFailure, changedComponents });
  } finally { await runtime.close(); }
}
