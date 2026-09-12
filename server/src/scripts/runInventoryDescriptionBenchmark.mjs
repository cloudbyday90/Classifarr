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

async function loadPrivateRuntime() {
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
      repository: createDescriptionBenchmarkRepository({ withTransaction: db.withTransaction }),
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
  if (values['fresh-policy-evaluation']) {
    if (values['policy-shortlist-replay'] || values.investigate || values['contrastive-investigation'] ||
        values['content-first-comparison'] || values['selective-recheck'] || values['preserve-description-candidate'] ||
        values['metadata-candidates'] || values['learned-profiles']) throw new Error('fresh_policy_requires_exclusive_mode');
    return runFreshInventoryPolicyEvaluation(options, { signal, onProgress, loadRuntime: loadFreshRuntime });
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
  const runtime = await loadRuntime();
  try {
    const representation = await inspectDescriptionRepresentation(runtime.embedder, abort);
    const snapshot = await runtime.repository.read(representation);
    await verifyDescriptionRepresentation(runtime.embedder, representation, abort);
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
  } finally { await runtime.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  runInventoryDescriptionBenchmark({ signal: controller.signal, onProgress: progress => process.stderr.write(`${JSON.stringify(progress)}\n`) })
    .then(report => {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (['interrupted', 'completed_with_errors', 'invalidated'].includes(report.status) || report.sampleShortfall ||
          report.arms.some(arm => arm.estimatedInputBudgetExceeded)) process.exitCode = 1;
    }).catch(() => {
      process.stderr.write('Description benchmark did not complete. Check local model availability and description cache coverage. No routing changes were made.\n');
      process.exitCode = 1;
    }).finally(() => { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); });
}
