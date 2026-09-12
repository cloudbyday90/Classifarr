/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSelection.mjs';
import { preparePolicyShortlistReplayCase, replayFingerprint } from './policyShortlistReplayCase.mjs';
import { loadPolicyShortlistReplayRuntime } from './policyShortlistReplayRuntime.mjs';
import { AIResponseParser } from './aiResponseParser.mjs';
import { CANDIDATE_ADJUDICATION_RESPONSE_VERSION } from './candidateAdjudicationResponseContract.mjs';
import { buildAiProviderAuthorityProfile } from './aiProviderAuthority.mjs';
import { finalizePolicyCandidateAdjudication } from './policyCandidateAdjudicationResult.mjs';
import { assessPolicyCandidateConsensus } from './policyCandidateConsensus.mjs';
import { evaluateClassificationRouteSafety } from './classificationRouteSafetyGate.mjs';
import { ADJUDICATION_REPLAY_OUTPUT_TOKENS } from './localDescriptionBenchmarkClient.mjs';
import { isReasoningModel } from './aiResponseNormalizer.mjs';

const parser = new AIResponseParser({ logger: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, () => {}])) });
const valid = result => ['proposed', 'abstained'].includes(result?.status);
const counts = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(item => item === value).length]));
const mean = values => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;

/** Production reducers only: never mint the fresh consensus receipt needed to route. */
export function reducePolicyShortlistReplayResponse(entry, arm, generated, identity) {
  const usage = { latencyMs: generated.latencyMs, promptTokens: generated.promptTokens, outputTokens: generated.outputTokens };
  if (generated.outputLimitReached || generated.contextLimitSuspected) return { ...usage,
    status: generated.outputLimitReached ? 'output_limited' : 'context_limit_suspected' };
  const { contract, evidence } = entry.arms[arm];
  const parsed = parser.parse(generated.response, {
    libraries: contract.candidates.map(candidate => candidate.library), metadata: entry.metadata, signalContext: entry.signalContext,
  }, { mode: 'adjudicate', contentLogs: false, logInvalid: false, logMalformed: false });
  const aiMatch = { ...parsed, ai_authority: buildAiProviderAuthorityProfile({
    providerId: 'ollama', model: identity.model, requestedMode: 'proposal' }) };
  const input = { contract, evidence, aiMatch, metadata: entry.metadata, policyResult: entry.policyResult, libraries: entry.libraries };
  const advisory = finalizePolicyCandidateAdjudication(input);
  const consensus = assessPolicyCandidateConsensus(input);
  const safety = evaluateClassificationRouteSafety({ result: { ...advisory, policyResult: entry.policyResult } });
  // Only schema-owned field names leave the private parser; never its error text.
  const validationFields = ['decision', 'library_number', 'confidence', 'reason', 'problem_summary', 'why_uncertain', 'question', 'options']
    .filter(field => typeof parsed.validation_errors === 'string' && parsed.validation_errors.includes(`[${field}]`));
  return { status: advisory.candidate_adjudication.statusId,
    destinationId: advisory.candidate_adjudication.proposedDestination?.library_id ?? null,
    consensusEligible: consensus.eligible, consensusReason: consensus.reason,
    automaticRouteAllowed: safety.automatic_route_allowed,
    blockingGates: safety.blocking_gates.map(gate => gate.id),
    validationFields, ...usage };
}

function summarize(results) {
  return { finished: results.length, statuses: counts(results.map(result => result.status)),
    consensusEligible: results.filter(result => result.consensusEligible).length,
    consensusReasons: counts(results.flatMap(result => result.consensusReason ? [result.consensusReason] : [])),
    automaticRouteAllowed: results.filter(result => result.automaticRouteAllowed).length,
    blockingGates: counts(results.flatMap(result => result.blockingGates ?? [])),
    validationFields: counts(results.flatMap(result => result.validationFields ?? [])),
    measuredCalls: results.filter(result => Number.isFinite(result.latencyMs)).length,
    latencyMs: mean(results.flatMap(result => Number.isFinite(result.latencyMs) ? [result.latencyMs] : [])),
    promptTokens: mean(results.flatMap(result => Number.isFinite(result.promptTokens) ? [result.promptTokens] : [])),
    outputTokens: mean(results.flatMap(result => Number.isFinite(result.outputTokens) ? [result.outputTokens] : [])) };
}

/** Retained-policy paired replay: all domain writers and routing capabilities are absent. */
export async function runPolicyShortlistReplay(settings, { signal, onProgress = () => {}, loadRuntime = loadPolicyShortlistReplayRuntime } = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  if (options.folds || options.excludePriorSize || options.excludePriorSizes.length) throw new Error('policy_replay_not_a_fold_benchmark');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  const runtime = await loadRuntime();
  try {
    const source = await runtime.repository.read(options.seed);
    if (source.config?.rag_enabled !== true || source.config.primary_provider !== 'ollama' || !Array.isArray(source.cases) || source.cases.length > 300) {
      throw new Error('policy_replay_source_unavailable');
    }
    const verify = async () => {
      abort.throwIfAborted();
      if ((await runtime.repository.read(options.seed)).fingerprint !== source.fingerprint) throw new Error('policy_replay_source_changed');
    };
    const selected = [...source.cases].sort((a, b) => {
      const rank = entry => replayFingerprint([options.seed, entry.metadata.media_type, entry.metadata.tmdb_id]);
      return rank(a).localeCompare(rank(b));
    }).slice(0, options.size);
    const prepared = [];
    for (const entry of selected) {
      abort.throwIfAborted();
      prepared.push(await preparePolicyShortlistReplayCase(entry, source, runtime, abort));
    }
    await verify();
    const requested = Math.min(options.generateCases, prepared.length);
    const client = requested ? runtime.createClient(source.config) : null;
    const identity = client ? await client.inspect(abort) : null;
    const pairs = [], actual = { baseline: [], protected: [] };
    let calls = 0, reused = 0;
    for (let index = 0; index < requested && !abort.aborted; index++) {
      const entry = prepared[index], pair = { mediaType: selected[index].metadata.media_type };
      pairs.push(pair);
      if (entry.status !== 'ready') { pair.baseline = pair.protected = { status: entry.status }; continue; }
      const samePrompt = !entry.changedShortlist && entry.arms.baseline.prompt === entry.arms.protected.prompt;
      for (const arm of samePrompt || index % 2 === 0 ? ['baseline', 'protected'] : ['protected', 'baseline']) {
        if (abort.aborted) break;
        if (samePrompt && arm === 'protected') { pair.protected = pair.baseline; reused++; continue; }
        try {
          const generated = await client.generate({ prompt: entry.arms[arm].prompt, count: entry.arms[arm].contract.candidates.length,
            context: options.context, identity, signal: abort, responseContract: 'adjudication', onGenerationCall: () => calls++ });
          abort.throwIfAborted();
          pair[arm] = reducePolicyShortlistReplayResponse(entry, arm, generated, identity);
        } catch { pair[arm] = { status: abort.aborted ? 'interrupted' : 'failed' }; }
        actual[arm].push(pair[arm]);
      }
      onProgress({ stage: 'policy_shortlist_replay', completedCases: pairs.length, requested, calls, reusedResults: reused });
      if (!abort.aborted) await verify();
    }
    if (!abort.aborted) await verify();
    const validPairs = pairs.filter(pair => valid(pair.baseline) && valid(pair.protected));
    return { version: 1, protocol: 'policy_shortlist_production_contract_replay_v1',
      status: abort.aborted ? 'interrupted' : !options.generateCases ? 'preflight'
        : pairs.some(pair => !valid(pair.baseline) || !valid(pair.protected)) ? 'completed_with_errors' : 'complete',
      sourceFingerprint: source.fingerprint, evidenceFingerprint: replayFingerprint(prepared.map(entry => entry.fingerprint ?? entry.status)),
      requestedMaximum: options.size, retainedIdentities: source.retainedIdentities, skippedMetadata: source.skippedMetadata,
      sampledTitles: prepared.length, sampleShortfall: 0, preparation: counts(prepared.map(entry => entry.status)),
      media: counts(selected.map(entry => entry.metadata.media_type)),
      changedShortlists: prepared.filter(entry => entry.changedShortlist).length,
      requestedGenerationCases: requested, calls, maximumCalls: requested * 2, reusedResults: reused,
      paired: { completed: pairs.length, valid: validPairs.length,
        changedProposals: validPairs.filter(pair => pair.baseline.destinationId !== pair.protected.destinationId).length,
        newlyConsensusEligible: validPairs.filter(pair => !pair.baseline.consensusEligible && pair.protected.consensusEligible).length,
        lostConsensusEligibility: validPairs.filter(pair => pair.baseline.consensusEligible && !pair.protected.consensusEligible).length },
      arms: Object.entries(actual).map(([id, results]) => ({ id, ...summarize(results) })),
      effectiveOutcomes: ['baseline', 'protected'].map(id => ({ id, ...summarize(pairs.flatMap(pair => pair[id] ? [pair[id]] : [])) })),
      generation: identity ? { ...identity, responseContractVersion: CANDIDATE_ADJUDICATION_RESPONSE_VERSION,
        context: options.context, temperature: 0, seed: 42, thinking: false,
        structuredOutput: !isReasoningModel(identity.model), outputLimit: ADJUDICATION_REPLAY_OUTPUT_TOKENS } : null,
      independentLabels: 0, accuracy: null, inputTruncation: 'unknown', freshPolicyEvaluation: false,
      liveRoutingChanged: false, routingReceiptsCreated: 0, userQuestionsCreated: 0, learningRecordsCreated: 0 };
  } finally { await runtime.close(); }
}
