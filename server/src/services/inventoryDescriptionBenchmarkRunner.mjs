/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildDescriptionBenchmarkPrompt, DESCRIPTION_BENCHMARK_ARMS, parseDescriptionBenchmarkProposal } from './inventoryDescriptionBenchmarkPrompt.mjs';
import { validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSample.mjs';
import { investigateDescriptionDisagreements } from './inventoryDescriptionBenchmarkInvestigation.mjs';

const summarize = values => values.length ? { count: values.length, min: Math.min(...values), max: Math.max(...values),
  mean: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
  p95: [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] } : { count: 0, min: null, max: null, mean: null, p95: null };

/** Keep private packets/responses in memory; return only allowlisted aggregates. */
export async function runDescriptionBenchmark(prepared, settings, { client, identity, signal, onProgress = () => {}, investigate = false, onPrivateCase } = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  const arms = DESCRIPTION_BENCHMARK_ARMS.map(budget => ({ budget, counts: [], bytes: [], shared: [], results: [] }));
  // Preflight every sampled title, even when inference is limited to a pilot.
  const packets = prepared.cases.map(entry => arms.map(arm => {
    const packet = buildDescriptionBenchmarkPrompt(entry, prepared.texts, arm.budget);
    arm.counts.push(packet.actualExamples); arm.bytes.push(Buffer.byteLength(packet.prompt)); arm.shared.push(packet.sharedExamples);
    return packet;
  }));
  const requested = Math.min(options.generateCases, prepared.cases.length);
  const paired = [];
  for (let index = 0; index < requested && !abort.aborted; index++) {
    const outcomes = new Map();
    for (let offset = 0; offset < arms.length && !abort.aborted; offset++) {
      const armIndex = (index + offset) % arms.length;
      const arm = arms[armIndex], entry = prepared.cases[index];
      const packet = packets[index][armIndex];
      if (packet.actualExamples === 0) { arm.results.push({ status: 'no_examples', caseIndex: index }); continue; }
      try {
        const result = await client.generate({ prompt: packet.prompt, count: entry.candidates.length, context: options.context, identity, signal: abort });
        const proposal = parseDescriptionBenchmarkProposal(result.response, entry.candidates.length);
        const status = result.outputLimitReached ? 'output_limit' : proposal === null ? 'invalid' : proposal === 0 ? 'abstained' : 'proposed';
        arm.results.push({ status, latencyMs: result.latencyMs, promptTokens: result.promptTokens, outputTokens: result.outputTokens,
          caseIndex: index,
          contextLimitSuspected: result.contextLimitSuspected,
          agreement: status === 'proposed' && entry.observedLibraryIds.includes(entry.candidates[proposal - 1].id) });
        if (status === 'proposed' || status === 'abstained') outcomes.set(arm.budget, proposal);
      } catch (error) {
        const status = error?.message === 'description_benchmark_context_budget' ? 'context_budget' : 'failed';
        arm.results.push({ status, caseIndex: index });
      }
      onProgress({ sampled: prepared.cases.length, requestedGenerationCases: requested,
        finishedArms: arms.reduce((sum, candidate) => sum + candidate.results.length, 0), totalArms: requested * 3 });
    }
    paired.push(outcomes);
  }
  const completed = arms.every(arm => arm.results.length === requested);
  const hasErrors = arms.some(arm => arm.results.some(result => !['proposed', 'abstained'].includes(result.status)));
  const investigation = investigate ? await investigateDescriptionDisagreements(prepared, paired,
    { client, identity, context: options.context, signal: abort, onPrivateCase }) : null;
  return {
    version: 1, status: options.generateCases === 0 ? 'preflight' : !completed ? 'interrupted' : hasErrors ? 'completed_with_errors' : 'complete',
    ...(investigation ? { investigation } : {}),
    ...(prepared.metadataSelection ? { metadataSelection: prepared.metadataSelection } : {}),
    ...(prepared.profileLearning ? { profileLearning: prepared.profileLearning } : {}),
    ...(prepared.evaluation ? { evaluation: prepared.evaluation } : {}),
    seed: options.seed, snapshotFingerprint: prepared.fingerprint, sampleFingerprint: prepared.sampleFingerprint,
    requestedTitles: options.size, sampledTitles: prepared.cases.length, sampleShortfall: Math.max(0, options.size - prepared.cases.length),
    excludedPriorDescriptions: prepared.excludedPriorDescriptions ?? 0,
    requestedGenerationCases: options.generateCases, availableGenerationCases: requested, independentLabels: 0, accuracy: null,
    observedPlacementIsGroundTruth: false, inputTruncation: 'unknown', liveRoutingChanged: false,
    representedLibraryStrata: prepared.strata,
    shortlistMissesObservedPlacement: prepared.cases.filter(entry => !entry.candidates.some(candidate => entry.observedLibraryIds.includes(candidate.id))).length,
    generation: identity ? { model: identity.model, digest: identity.digest, context: options.context, temperature: 0, seed: 42, thinking: false, outputLimit: 64 } : null,
    arms: arms.map(arm => ({ examples: arm.budget, actualExamples: summarize(arm.counts), promptBytes: summarize(arm.bytes), sharedExamples: summarize(arm.shared),
      estimatedInputBudgetExceeded: arm.bytes.filter(bytes => bytes > (options.context - 64) * 3).length,
      finished: arm.results.length, skipped: requested - arm.results.length,
      statuses: Object.fromEntries(['proposed', 'abstained', 'invalid', 'output_limit', 'context_budget', 'no_examples', 'failed']
        .map(status => [status, arm.results.filter(result => result.status === status).length])),
      latencyMs: summarize(arm.results.flatMap(result => result.latencyMs === undefined ? [] : [result.latencyMs])),
      promptTokens: summarize(arm.results.flatMap(result => result.promptTokens === undefined ? [] : [result.promptTokens])),
      outputTokens: summarize(arm.results.flatMap(result => result.outputTokens === undefined ? [] : [result.outputTokens])),
      contextLimitSuspected: arm.results.filter(result => result.contextLimitSuspected).length,
      observedPlacementAgreement: { agreed: arm.results.filter(result => result.agreement).length,
        proposals: arm.results.filter(result => result.status === 'proposed').length },
      ...(prepared.libraryStrata ? { libraryAgreement: prepared.libraryStrata.map(({ id, stratum }) => {
        const cases = prepared.cases.slice(0, requested).map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.observedLibraryIds.includes(id));
        const indices = new Set(cases.map(({ index }) => index));
        const results = arm.results.filter(result => indices.has(result.caseIndex));
        return { stratum, sampled: cases.length, finished: results.length,
          proposals: results.filter(result => result.status === 'proposed').length,
          agreed: results.filter(result => result.agreement).length };
      }) } : {}),
    })),
    paired: [30, 100].map(budget => {
      const eligible = paired.filter(outcomes => outcomes.has(9) && outcomes.has(budget));
      return { baseline: 9, examples: budget, validPairs: eligible.length,
        changedProposalOrAbstention: eligible.filter(outcomes => outcomes.get(9) !== outcomes.get(budget)).length };
    }),
  };
}
