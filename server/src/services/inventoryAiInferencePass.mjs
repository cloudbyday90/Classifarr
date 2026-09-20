/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DESCRIPTION_BENCHMARK_OUTPUT_TOKENS } from './localDescriptionBenchmarkClient.mjs';

/** Common boundary for the two bounded 64-token experiment contracts; never log content. */
export async function runInventoryAiPass({ client, identity, signal, context, prompt, count, responseContract, parse, stats }) {
  try {
    signal?.throwIfAborted();
    const result = await client.generate({ prompt, count, context, identity, signal, responseContract,
      onGenerationCall: () => { stats.calls++; } });
    signal?.throwIfAborted();
    const value = parse(result.response);
    if (result.outputLimitReached) return { failure: 'output_limit' };
    if (result.contextLimitSuspected) return { failure: 'context_limit' };
    if (value === undefined || !Number.isSafeInteger(result.latencyMs) || result.latencyMs < 0 ||
        !Number.isSafeInteger(result.promptTokens) || result.promptTokens < 1 || result.promptTokens > context ||
        !Number.isSafeInteger(result.outputTokens) || result.outputTokens < 0 || result.outputTokens > DESCRIPTION_BENCHMARK_OUTPUT_TOKENS) {
      return { failure: 'invalid_response' };
    }
    stats.validPasses++; stats.latencyMs += result.latencyMs;
    stats.promptTokens += result.promptTokens; stats.outputTokens += result.outputTokens;
    return { value };
  } catch { return { failure: signal?.aborted ? 'interrupted' : 'provider_failed' }; }
}
