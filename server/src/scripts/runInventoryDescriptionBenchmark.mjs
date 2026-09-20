/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createLocalStudyEmbeddingClient } from '../services/localStudyEmbeddingClient.mjs';
import { inspectDescriptionRepresentation, verifyDescriptionRepresentation } from '../services/inventoryDescriptionBatchWriter.mjs';
import { createDescriptionBenchmarkRepository } from '../services/inventoryDescriptionBenchmarkRepository.mjs';
import { prepareDescriptionBenchmark, validateDescriptionBenchmarkOptions } from '../services/inventoryDescriptionBenchmarkSample.mjs';
import { createLocalDescriptionBenchmarkClient } from '../services/localDescriptionBenchmarkClient.mjs';
import { runDescriptionBenchmark } from '../services/inventoryDescriptionBenchmarkRunner.mjs';
import { runContrastiveInventoryInvestigation } from '../services/inventoryContrastiveInvestigation.mjs';
import { runContentFirstInventoryComparison } from '../services/inventoryContentFirstComparison.mjs';
import { runPolicyShortlistReplay } from '../services/policyShortlistReplay.mjs';
import { runFreshInventoryPolicyEvaluation } from '../services/freshInventoryPolicyEvaluation.mjs';
import { runInventoryNeighborComparison } from '../services/inventoryNeighborComparison.mjs';
import { runInventoryEvidenceRerankerComparison } from '../services/inventoryEvidenceRerankerComparison.mjs';
import { runInventorySemanticPairComparison } from '../services/inventorySemanticPairComparison.mjs';
import { describeInventorySnapshotDigests } from '../services/inventoryDescriptionSnapshotDigests.mjs';
import { describeMultiScaleAiInputs } from '../services/inventoryMultiScaleAiInputs.mjs';
import { runInventoryCoverageBenchmark } from '../services/inventoryCoverageBenchmark.mjs';
import { runInventoryCandidateStabilityBenchmark } from '../services/inventoryCandidateStabilityBenchmark.mjs';
import { runInventoryAdaptiveGroupBenchmark } from '../services/inventoryAdaptiveGroupBenchmark.mjs';
import { runInventoryCommunityBenchmark } from '../services/inventoryCommunityBenchmark.mjs';
import { runInventoryMultiScaleBenchmark } from '../services/inventoryMultiScaleBenchmark.mjs';
import { runInventoryMultiScaleAiBenchmark } from '../services/inventoryMultiScaleAiBenchmark.mjs';
import { createInventoryDiscoveryAdmission, DiscoveryDeferredError } from '../services/inventoryDiscoveryAdmission.mjs';
import { runInventoryLinearRankerBenchmark } from '../services/inventoryLinearRankerBenchmark.mjs';
import { describeLinearRankerInputs } from '../services/inventoryLinearRankerSource.mjs';

async function loadPrivateRuntime({ includeTrainingProvenance = false } = {}) {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c statement_timeout=15000 -c lock_timeout=1000`.trim();
  const db = await import('../config/database.mjs');
  try {
    const { rows } = await db.query(`SELECT rag_enabled, embedding_provider_mode, primary_provider,
      embedding_model, embedding_ollama_host, embedding_ollama_port, embedding_ollama_model,
      ollama_host, ollama_port, ollama_model FROM ai_provider_config WHERE id=1`);
    const config = rows[0];
    return { embedder: createLocalStudyEmbeddingClient(config),
      withDiscoveryAdmission: createInventoryDiscoveryAdmission(db),
      repository: createDescriptionBenchmarkRepository({ withTransaction: db.withTransaction, includeTrainingProvenance }),
      createClient: () => createLocalDescriptionBenchmarkClient(config), close: () => db.pool.end() };
  } catch (error) { await db.pool.end(); throw error; }
}

export async function runInventoryDescriptionBenchmark({ argv = process.argv.slice(2), loadRuntime = loadPrivateRuntime, loadReplayRuntime, loadFreshRuntime, signal, onProgress, onPrivateCase } = {}) {
  const { values } = parseArgs({ args: argv, options: { seed: { type: 'string' }, size: { type: 'string' },
    'generate-cases': { type: 'string' }, context: { type: 'string' }, 'max-minutes': { type: 'string' },
    'exclude-prior-size': { type: 'string' }, 'exclude-prior-sizes': { type: 'string' }, folds: { type: 'string' },
    investigate: { type: 'boolean' }, 'contrastive-investigation': { type: 'boolean' }, 'content-first-comparison': { type: 'boolean' },
    'selective-recheck': { type: 'boolean' },
    'policy-shortlist-replay': { type: 'boolean' },
    'fresh-policy-evaluation': { type: 'boolean' },
    'neighbor-calibration': { type: 'boolean' },
    'neighbor-cross-fit': { type: 'boolean' },
    'neighbor-fallback': { type: 'boolean' },
    'evidence-reranker': { type: 'boolean' },
    'neighborhood-profiles': { type: 'boolean' },
    'representative-groups': { type: 'boolean' },
    'representative-stability': { type: 'boolean' },
    'semantic-pairs': { type: 'boolean' },
    'coverage-robustness': { type: 'boolean' },
    'candidate-stability': { type: 'boolean' },
    'candidate-local-evidence': { type: 'boolean' },
    'group-contrast': { type: 'boolean' },
    'group-semantics': { type: 'boolean' },
    'adaptive-groups': { type: 'boolean' },
    'local-communities': { type: 'boolean' },
    'multi-scale-context': { type: 'boolean' },
    'multi-scale-ai': { type: 'boolean' },
    'independent-fit': { type: 'boolean' },
    'linear-ranker': { type: 'boolean' },
    'preserve-description-candidate': { type: 'boolean' },
    'metadata-candidates': { type: 'boolean' }, 'learned-profiles': { type: 'boolean' } } });
  if (values['metadata-candidates'] && values['learned-profiles']) throw new Error('description_benchmark_selection_mode_conflict');
  const options = validateDescriptionBenchmarkOptions({ seed: values.seed,
    ...(values.size === undefined ? {} : { size: Number(values.size) }),
    ...(values['exclude-prior-size'] === undefined ? {} : { excludePriorSize: Number(values['exclude-prior-size']) }),
    ...(values['exclude-prior-sizes'] === undefined ? {} : { excludePriorSizes: values['exclude-prior-sizes'].split(',').map(Number) }),
    ...(values.folds === undefined ? {} : { folds: Number(values.folds) }),
    ...(values['generate-cases'] === undefined ? {} : { generateCases: Number(values['generate-cases']) }),
    ...(values.context === undefined ? {} : { context: Number(values.context) }),
    ...(values['max-minutes'] === undefined ? {} : { maxMinutes: Number(values['max-minutes']) }),
  });
  for (const mode of ['candidate-stability', 'candidate-local-evidence', 'group-contrast', 'adaptive-groups', 'local-communities', 'multi-scale-context', 'linear-ranker']) {
    if (values[mode] && (!options.folds || options.generateCases ||
        Object.entries(values).some(([name, value]) => name !== mode && value === true))) {
      throw new Error(`${mode.replaceAll('-', '_')}_requires_exclusive_grouped_zero_generation`);
    }
  }
  if (values['independent-fit'] && !values['multi-scale-ai']) throw new Error('independent_fit_requires_multi_scale_ai');
  if (values['multi-scale-ai'] && (!options.folds || options.generateCases > 100 ||
      Object.entries(values).some(([name, value]) => !['multi-scale-ai', 'independent-fit'].includes(name) && value === true))) {
    throw new Error('multi_scale_ai_requires_exclusive_grouped_bounded_mode');
  }
  if (values['coverage-robustness'] && (!options.folds || options.generateCases ||
      Object.entries(values).some(([name, value]) => name !== 'coverage-robustness' && value === true))) {
    throw new Error('coverage_benchmark_requires_exclusive_grouped_zero_generation');
  }
  if (values['semantic-pairs'] && (!options.folds || Object.entries(values).some(([name, value]) => name !== 'semantic-pairs' && value === true))) {
    throw new Error('semantic_pairs_require_exclusive_grouped_mode');
  }
  if (values['group-semantics'] && (!options.folds || options.generateCases > 100 ||
      Object.entries(values).some(([name, value]) => name !== 'group-semantics' && value === true))) {
    throw new Error('group_semantics_requires_exclusive_grouped_bounded_mode');
  }
  if (values['neighborhood-profiles'] && !values['evidence-reranker']) throw new Error('neighborhood_profiles_requires_evidence_reranker');
  if (values['representative-stability'] && !values['representative-groups']) throw new Error('representative_stability_requires_groups');
  if (values['representative-groups'] && (!values['evidence-reranker'] || values['neighborhood-profiles'])) {
    throw new Error('representative_groups_require_exclusive_evidence_reranker');
  }
  if (values['evidence-reranker'] && (!options.folds || options.generateCases ||
      ['fresh-policy-evaluation', 'policy-shortlist-replay', 'investigate', 'contrastive-investigation',
        'content-first-comparison', 'selective-recheck', 'preserve-description-candidate', 'metadata-candidates',
        'learned-profiles', 'neighbor-calibration', 'neighbor-cross-fit', 'neighbor-fallback'].some(mode => values[mode]))) {
    throw new Error('inventory_reranker_requires_exclusive_grouped_zero_generation');
  }
  if (values['neighbor-cross-fit'] && !values['neighbor-calibration']) throw new Error('neighbor_cross_fit_requires_neighbor_calibration');
  if (values['neighbor-fallback'] && !values['fresh-policy-evaluation']) throw new Error('neighbor_fallback_requires_fresh_policy_evaluation');
  if (values['neighbor-calibration'] && (!options.folds || options.generateCases ||
      ['fresh-policy-evaluation', 'policy-shortlist-replay', 'investigate', 'contrastive-investigation',
        'content-first-comparison', 'selective-recheck', 'preserve-description-candidate', 'metadata-candidates', 'learned-profiles']
        .some(mode => values[mode]))) throw new Error('neighbor_comparison_requires_exclusive_grouped_zero_generation');
  if (values['fresh-policy-evaluation']) {
    if (values['policy-shortlist-replay'] || values.investigate || values['contrastive-investigation'] ||
        values['content-first-comparison'] || values['selective-recheck'] || values['preserve-description-candidate'] ||
        values['metadata-candidates'] || values['learned-profiles']) throw new Error('fresh_policy_requires_exclusive_mode');
    return runFreshInventoryPolicyEvaluation(options, { signal, onProgress, loadRuntime: loadFreshRuntime,
      neighborFallback: values['neighbor-fallback'] === true });
  }
  if (values['policy-shortlist-replay']) {
    if (values.investigate || values['contrastive-investigation'] || values['content-first-comparison'] || values['selective-recheck'] ||
        values['preserve-description-candidate'] || values['metadata-candidates'] || values['learned-profiles']) {
      throw new Error('policy_replay_requires_exclusive_mode');
    }
    return runPolicyShortlistReplay(options, { signal, onProgress, loadRuntime: loadReplayRuntime });
  }
  if (values['contrastive-investigation'] && (!options.folds || values.investigate)) {
    throw new Error('contrastive_investigation_requires_folds_and_exclusive_mode');
  }
  if (values['content-first-comparison'] && (!options.folds || values.investigate || values['contrastive-investigation'])) {
    throw new Error('content_first_comparison_requires_folds_and_exclusive_mode');
  }
  if (values['selective-recheck'] && (!options.folds || !values['learned-profiles'] || values.investigate ||
    values['contrastive-investigation'] || values['content-first-comparison'])) {
    throw new Error('selective_recheck_requires_grouped_profiles_and_exclusive_mode');
  }
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  if (values['preserve-description-candidate'] && (!options.folds || !values['learned-profiles'])) {
    throw new Error('description_anchor_requires_grouped_profiles');
  }
  const runtime = values['linear-ranker'] ? await loadRuntime({ includeTrainingProvenance: true }) : await loadRuntime();
  try {
    return await runtime.withDiscoveryAdmission(async abort => {
      const representation = await inspectDescriptionRepresentation(runtime.embedder, abort);
      const snapshot = await runtime.repository.read(representation);
      await verifyDescriptionRepresentation(runtime.embedder, representation, abort);
      if (values['linear-ranker']) {
        const report = await runInventoryLinearRankerBenchmark(snapshot, representation.dimensions, options, { signal: abort, onProgress });
        const current = await runtime.repository.read(representation);
        await verifyDescriptionRepresentation(runtime.embedder, representation, abort);
        abort.throwIfAborted();
        const currentComponents = describeLinearRankerInputs(current);
        const sourceVerified = JSON.stringify(currentComponents) === JSON.stringify(report.snapshotComponents);
        const changedSourceComponents = Object.keys(currentComponents.hashes).filter(name => currentComponents.hashes[name] !== report.snapshotComponents.hashes[name]);
        return { ...report, status: sourceVerified ? report.status : 'invalidated', sourceVerified, changedSourceComponents,
          embedding: { model: representation.model, digest: representation.digest, dimensions: representation.dimensions } };
      }
      if (values['evidence-reranker'] || values['semantic-pairs'] || values['coverage-robustness'] || values['candidate-stability'] || values['candidate-local-evidence'] || values['group-contrast'] || values['group-semantics'] || values['adaptive-groups'] || values['local-communities'] || values['multi-scale-context'] || values['multi-scale-ai']) {
        const pairClient = (values['semantic-pairs'] || values['group-semantics'] || values['multi-scale-ai']) && options.generateCases ? runtime.createClient() : undefined;
        const pairIdentity = pairClient ? await pairClient.inspect(abort) : undefined;
        const report = values['multi-scale-ai']
          ? await runInventoryMultiScaleAiBenchmark(snapshot, representation, options, { signal: abort, onProgress, client: pairClient, identity: pairIdentity,
            independentFit: values['independent-fit'] === true })
          : values['multi-scale-context']
          ? await runInventoryMultiScaleBenchmark(snapshot, representation, options, { signal: abort, onProgress })
          : values['local-communities']
          ? await runInventoryCommunityBenchmark(snapshot, representation.dimensions, options, { signal: abort, onProgress })
          : values['adaptive-groups']
          ? await runInventoryAdaptiveGroupBenchmark(snapshot, representation.dimensions, options, { signal: abort, onProgress })
          : values['candidate-stability'] || values['candidate-local-evidence'] || values['group-contrast'] || values['group-semantics']
          ? await runInventoryCandidateStabilityBenchmark(snapshot, representation.dimensions, options,
            { signal: abort, onProgress, localEvidence: values['candidate-local-evidence'] === true, groupContrast: values['group-contrast'] === true,
              groupSemantics: values['group-semantics'] === true, client: pairClient, identity: pairIdentity })
          : values['coverage-robustness']
          ? await runInventoryCoverageBenchmark(snapshot, representation.dimensions, options, { signal: abort, onProgress })
          : values['semantic-pairs']
          ? await runInventorySemanticPairComparison(snapshot, representation.dimensions, options,
            { signal: abort, onProgress, client: pairClient, identity: pairIdentity })
          : await runInventoryEvidenceRerankerComparison(snapshot, representation.dimensions, options,
            { signal: abort, onProgress, neighborhoodProfiles: values['neighborhood-profiles'] === true,
              representativeGroups: values['representative-groups'] === true, representativeStability: values['representative-stability'] === true });
        if (abort.aborted) return { ...report, status: 'interrupted', sourceVerified: false };
        const current = await runtime.repository.read(representation);
        await verifyDescriptionRepresentation(runtime.embedder, representation, abort);
        const currentComponents = values['multi-scale-ai'] ? describeMultiScaleAiInputs(current)
          : describeInventorySnapshotDigests(current, current.vectors);
        const sourceVerified = JSON.stringify(currentComponents) === JSON.stringify(report.snapshotComponents);
        const changedSourceComponents = Object.keys(currentComponents.hashes).filter(name =>
          currentComponents.hashes[name] !== report.snapshotComponents.hashes[name]);
        return { ...report, status: sourceVerified ? report.status : 'invalidated', sourceVerified, changedSourceComponents,
          embedding: { model: representation.model, digest: representation.digest, dimensions: representation.dimensions } };
      }
      if (values['neighbor-calibration']) {
        const report = await runInventoryNeighborComparison(snapshot, representation, options,
          { signal: abort, onProgress, crossFit: values['neighbor-cross-fit'] === true });
        return { ...report, embedding: { model: representation.model, digest: representation.digest, dimensions: representation.dimensions } };
      }
      const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, representation.dimensions, options,
        { metadataCandidates: values['metadata-candidates'] === true, learnedProfiles: values['learned-profiles'] === true,
          includeContrastiveVectors: values['contrastive-investigation'] === true,
          includeComparisonEvidence: values['content-first-comparison'] === true || values['selective-recheck'] === true || values['preserve-description-candidate'] === true,
          includeConflictEvidence: values['selective-recheck'] === true,
          preserveDescriptionCandidate: values['preserve-description-candidate'] === true });
      const client = options.generateCases ? runtime.createClient() : undefined;
      const identity = client ? await client.inspect(abort) : undefined;
      const runner = values['content-first-comparison'] || values['selective-recheck'] ? runContentFirstInventoryComparison
        : values['contrastive-investigation'] ? runContrastiveInventoryInvestigation : runDescriptionBenchmark;
      const report = await runner(prepared, options, { client, identity, signal: abort, onProgress,
        investigate: values.investigate === true, selectiveRecheck: values['selective-recheck'] === true, onPrivateCase });
      return { ...report, embedding: { model: representation.model, digest: representation.digest, dimensions: representation.dimensions } };
    }, { signal: abort });
  } catch (error) {
    if (!(error instanceof DiscoveryDeferredError)) throw error;
    return { protocol: 'inventory_discovery_admission_v1', status: 'deferred', reason: error.reason,
      sourceVerified: false, livePromotionAllowed: false };
  } finally { await runtime.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  runInventoryDescriptionBenchmark({ signal: controller.signal, onProgress: progress => process.stderr.write(`${JSON.stringify(progress)}\n`) })
    .then(report => {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (['interrupted', 'completed_with_errors', 'invalidated', 'deferred'].includes(report.status) || report.sampleShortfall || report.generationShortfall ||
          report.arms?.some(arm => arm.estimatedInputBudgetExceeded)) process.exitCode = 1;
    }).catch(() => {
      process.stderr.write('Description benchmark did not complete. Check local model availability and description cache coverage. No routing changes were made.\n');
      process.exitCode = 1;
    }).finally(() => { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); });
}
