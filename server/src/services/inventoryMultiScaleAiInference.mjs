/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DESCRIPTION_BENCHMARK_OUTPUT_TOKENS } from './localDescriptionBenchmarkClient.mjs';
import { parseMultiScaleAiChoice } from './inventoryMultiScaleAiCase.mjs';

const armStats = name => ({ name, calls: 0, validPasses: 0, latencyMs: 0, promptTokens: 0, outputTokens: 0 });

/** Four passes per case, stopping rather than silently repairing invalid/provider output. */
export function createMultiScaleAiInference(options, { client, identity, signal, onProgress } = {}) {
  const arms = [armStats('raw'), armStats('compact')], failures = {};
  let attemptedCases = 0, completePairs = 0, failed = false;
  const fail = status => { failed = true; failures[status] = (failures[status] ?? 0) + 1; };
  return {
    async compare(plan, prompts, ordinal) {
      if (failed || signal?.aborted || attemptedCases >= options.generateCases) return null;
      attemptedCases++;
      const choices = [[], []];
      // Counterbalance arm order and candidate-order timing independently across cases.
      for (let offset = 0; offset < 2; offset++) {
        const armIndex = (ordinal + offset) % 2, stats = arms[armIndex];
        for (let pass = 0; pass < 2; pass++) {
          const reverse = (Math.floor(ordinal / 2) + pass) % 2;
          try {
            signal?.throwIfAborted();
            const result = await client.generate({ prompt: prompts[armIndex][reverse], count: plan.candidates.length,
              context: options.context, identity, signal, responseContract: 'candidate', onGenerationCall: () => { stats.calls++; } });
            signal?.throwIfAborted();
            const choice = parseMultiScaleAiChoice(result.response, plan.candidates, reverse === 1);
            if (result.outputLimitReached || result.contextLimitSuspected || choice === undefined ||
                !Number.isSafeInteger(result.latencyMs) || result.latencyMs < 0 ||
                !Number.isSafeInteger(result.promptTokens) || result.promptTokens < 1 || result.promptTokens > options.context ||
                !Number.isSafeInteger(result.outputTokens) || result.outputTokens < 0 || result.outputTokens > DESCRIPTION_BENCHMARK_OUTPUT_TOKENS) {
              fail(result.outputLimitReached ? 'output_limit' : result.contextLimitSuspected ? 'context_limit' : 'invalid_response');
              return null;
            }
            stats.validPasses++; stats.latencyMs += result.latencyMs;
            stats.promptTokens += result.promptTokens; stats.outputTokens += result.outputTokens;
            choices[armIndex][reverse] = choice;
            onProgress?.({ stage: 'multi_scale_ai_inference', attemptedCases, completePairs, calls: arms.reduce((sum, arm) => sum + arm.calls, 0) });
          } catch { fail(signal?.aborted ? 'interrupted' : 'provider_failed'); return null; }
        }
      }
      completePairs++;
      return choices.map(([forward, reverse]) => forward !== reverse ? { status: 'order_sensitive' }
        : forward === null ? { status: 'abstained' } : { status: 'selected', id: forward });
    },
    read() {
      return { status: signal?.aborted ? 'interrupted' : failed ? 'completed_with_errors' : options.generateCases ? 'complete' : 'preflight',
        calls: arms.reduce((sum, arm) => sum + arm.calls, 0), attemptedCases, completePairs, failures: { ...failures }, arms: structuredClone(arms),
        requestedGenerationCases: options.generateCases, maximumCalls: options.generateCases * 4,
        model: identity?.model ?? null, digest: identity?.digest ?? null, context: options.context, temperature: 0, seed: 42,
        outputLimit: DESCRIPTION_BENCHMARK_OUTPUT_TOKENS, inputTruncation: 'unknown' };
    },
  };
}
