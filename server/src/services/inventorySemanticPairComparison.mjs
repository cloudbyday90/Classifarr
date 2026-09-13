/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { prepareDescriptionBenchmark, validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSample.mjs';
import { prepareInventoryRerankerRows } from './inventoryEvidenceRerankerSample.mjs';
import { rankInventoryEvidence } from './inventoryEvidenceReranker.mjs';
import { inventoryEvidenceLeaderState } from './inventoryNeighborhoodReranker.mjs';
import { createInventoryNeighborhoodIndex } from './inventoryNeighborhoodProfiles.mjs';
import { INVENTORY_DESCRIPTION_PROJECTION_VERSION } from './inventoryDescriptionProjection.mjs';
import { prepareInventorySemanticPairs, buildInventorySemanticPairPrompt } from './inventorySemanticPairPrompt.mjs';
import { parseInventoryPairGrades, chooseInventorySemanticCandidate, INVENTORY_SEMANTIC_PAIR_OUTPUT_TOKENS } from './inventorySemanticPairContract.mjs';

const summarize = rows => ({ evaluated: rows.length, baselineAgreed: rows.filter(row => row.before).length,
  rerankerAgreed: rows.filter(row => row.after).length, gainedAgreement: rows.filter(row => !row.before && row.after).length,
  lostAgreement: rows.filter(row => row.before && !row.after).length, changed: rows.filter(row => row.changed).length });

/** Bounded local inference pilot; no domain writes and no automatic adoption. */
export async function runInventorySemanticPairComparison(snapshot, dimensions, settings,
  { client, identity, signal, onProgress = () => {} } = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  if (!options.folds) throw new Error('semantic_pairs_require_grouped_holdouts');
  if (snapshot.corpus.texts.size * dimensions * options.size > 20_000_000_000) throw new Error('semantic_pairs_work_budget');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, dimensions, options, { includeComparisonEvidence: true });
  const index = createInventoryNeighborhoodIndex(snapshot.corpus.documents, null, snapshot.libraries);
  const rows = prepareInventoryRerankerRows(snapshot, prepared).map(row => {
    const baseline = row.candidates.length ? rankInventoryEvidence(row.candidates)[0] : null;
    const state = baseline === null ? 'incomplete_evidence' : inventoryEvidenceLeaderState(row.candidates);
    const plan = state === 'disagreement' ? prepareInventorySemanticPairs(index, row.entry, prepared.texts) : null;
    const prompts = plan?.status === 'ready' ? [false, true].map(reverse => buildInventorySemanticPairPrompt(plan, reverse)) : [];
    const status = prompts.some(prompt => Buffer.byteLength(prompt) > (options.context - INVENTORY_SEMANTIC_PAIR_OUTPUT_TOKENS) * 3)
      ? 'context_budget' : plan?.status === 'ready' ? 'not_run' : plan?.status ?? state;
    return { row, baseline, state, plan, prompts, status, attempted: false,
      before: row.observedLibraryIds.includes(baseline), after: row.observedLibraryIds.includes(baseline), changed: false };
  });
  const eligible = rows.filter(row => row.status === 'not_run');
  let calls = 0, latencyMs = 0, promptTokens = 0, outputTokens = 0, validPasses = 0, error = false;
  for (const item of eligible.slice(0, options.generateCases)) {
    await setImmediate();
    if (abort.aborted) break;
    item.attempted = true;
    const grades = [];
    try {
      for (const prompt of item.prompts) {
        abort.throwIfAborted();
        const result = await client.generate({ prompt, count: item.plan.examples.length, context: options.context,
          identity, signal: abort, responseContract: 'pair_relevance', onGenerationCall: () => { calls++; } });
        abort.throwIfAborted();
        latencyMs += result.latencyMs; promptTokens += result.promptTokens; outputTokens += result.outputTokens;
        const parsed = parseInventoryPairGrades(result.response, item.plan.examples.length);
        if (result.outputLimitReached || result.contextLimitSuspected || !parsed) {
          item.status = result.outputLimitReached ? 'output_limit' : result.contextLimitSuspected ? 'context_limit' : 'invalid_response';
          error = true; break;
        }
        grades.push(parsed); validPasses++;
        onProgress({ stage: 'semantic_pairs', calls, validPasses, attemptedCases: rows.filter(row => row.attempted).length });
        abort.throwIfAborted();
      }
      if (grades.length === 2) {
        const first = chooseInventorySemanticCandidate(item.plan.examples, grades[0]);
        const second = chooseInventorySemanticCandidate(item.plan.examples, [...grades[1]].reverse());
        item.status = first === null || second === null ? 'weak_evidence' : first !== second ? 'order_sensitive' : 'supported';
        if (item.status === 'supported') {
          item.after = item.row.observedLibraryIds.includes(first);
          item.changed = first !== item.baseline;
        }
      }
    } catch {
      item.status = abort.aborted ? 'interrupted' : 'provider_failed'; error = true;
    }
    // Stop on protocol/transport errors; never turn a failure into repeated repair calls.
    if (error) break;
  }
  await setImmediate();
  const attempted = rows.filter(row => row.attempted);
  return { version: 1, protocol: 'inventory_semantic_pairs_v1',
    status: abort.aborted ? 'interrupted' : error ? 'completed_with_errors' : options.generateCases ? 'complete' : 'preflight',
    seed: options.seed, snapshotFingerprint: prepared.fingerprint, snapshotComponents: prepared.snapshotComponents,
    sampleFingerprint: prepared.sampleFingerprint, evaluation: prepared.evaluation,
    descriptionProjection: { version: INVENTORY_DESCRIPTION_PROJECTION_VERSION,
      shortenedInventoryIdentities: snapshot.corpus.coverage.shortenedIdentities },
    sampledTitles: rows.length, sampleShortfall: Math.max(0, options.size - rows.length),
    eligiblePairCases: eligible.length, requestedGenerationCases: options.generateCases, attemptedCases: attempted.length,
    notAttemptedEligibleCases: eligible.length - attempted.length, calls, validPasses, arms: [],
    statuses: Object.fromEntries([...new Set(rows.map(row => row.status))].sort().map(status => [status, rows.filter(row => row.status === status).length])),
    comparison: summarize(attempted), consensusControls: summarize(rows.filter(row => row.state === 'consensus')),
    media: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarize(attempted.filter(row => row.row.entry.mediaType === mediaType)) })),
    libraries: prepared.libraryStrata.map(({ id, stratum }) => ({ stratum,
      ...summarize(attempted.filter(row => row.row.observedLibraryIds.includes(id))) })),
    inference: { latencyMs, promptTokens, outputTokens, maximumCalls: Math.min(options.generateCases, eligible.length) * 2,
      model: identity?.model ?? null, digest: identity?.digest ?? null, context: options.context,
      temperature: 0, seed: 42, outputLimit: INVENTORY_SEMANTIC_PAIR_OUTPUT_TOKENS, inputTruncation: 'unknown' },
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false,
    liveRoutingChanged: false, livePromotionAllowed: false, userQuestionsCreated: 0, verifiedLabelsCreated: 0 };
}
