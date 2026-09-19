/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildGroupSemanticPrompt, parseGroupSemanticGrades, chooseGroupSemanticCandidate, GROUP_SEMANTIC_OUTPUT_TOKENS } from './inventoryGroupSemanticContract.mjs';

/** Per-run bounded inference and aggregate-only diagnostics. No retries or writes. */
export function createGroupSemanticComparison(options, { client, identity, signal, onProgress } = {}) {
  const statuses = {}, stats = { eligibleCases: 0, attemptedCases: 0, calls: 0, validPasses: 0, latencyMs: 0, promptTokens: 0, outputTokens: 0 };
  let failed = false;
  const record = status => { statuses[status] = (statuses[status] ?? 0) + 1; };
  return {
    async compare(plan, baseline) {
      if (baseline.reason !== 'local_overlapping_examples') { record('preserved_baseline'); return baseline; }
      if (plan.status !== 'ready') { record(plan.status); return baseline; }
      const prompts = [false, true].map(reverse => buildGroupSemanticPrompt(plan, reverse));
      if (prompts.some(prompt => Buffer.byteLength(prompt) > (options.context - GROUP_SEMANTIC_OUTPUT_TOKENS) * 3)) {
        record('semantic_context_budget'); return baseline;
      }
      stats.eligibleCases++;
      if (failed || stats.attemptedCases >= options.generateCases) { record(failed ? 'semantic_stopped' : 'semantic_not_run'); return baseline; }
      stats.attemptedCases++;
      const choices = [];
      try {
        for (const [index, prompt] of prompts.entries()) {
          signal?.throwIfAborted();
          const result = await client.generate({ prompt, count: plan.candidates.length, context: options.context,
            identity, signal, responseContract: 'group_relevance', onGenerationCall: () => { stats.calls++; } });
          signal?.throwIfAborted();
          stats.latencyMs += result.latencyMs; stats.promptTokens += result.promptTokens; stats.outputTokens += result.outputTokens;
          const grades = parseGroupSemanticGrades(result.response, plan.candidates.length);
          if (!grades || result.outputLimitReached || result.contextLimitSuspected) {
            failed = true;
            record(result.outputLimitReached ? 'semantic_output_limit' : result.contextLimitSuspected ? 'semantic_context_limit' : 'semantic_invalid_response');
            return baseline;
          }
          stats.validPasses++;
          choices.push(chooseGroupSemanticCandidate(plan.candidates, index ? [...grades].reverse() : grades));
          onProgress?.({ stage: 'group_semantics', calls: stats.calls, attemptedCases: stats.attemptedCases, validPasses: stats.validPasses });
        }
      } catch {
        failed = true; record(signal?.aborted ? 'semantic_interrupted' : 'semantic_provider_failed'); return baseline;
      }
      const status = choices.includes(null) ? 'semantic_weak_evidence' : choices[0] !== choices[1] ? 'semantic_order_sensitive' : 'semantic_supported';
      record(status);
      return status === 'semantic_supported' ? { reason: 'selected', id: choices[0] } : baseline;
    },
    read() {
      return { ...stats, statuses: { ...statuses }, status: failed ? 'completed_with_errors' : options.generateCases ? 'complete' : 'preflight',
        requestedGenerationCases: options.generateCases, maximumCalls: Math.min(options.generateCases, stats.eligibleCases) * 2,
        model: identity?.model ?? null, digest: identity?.digest ?? null, context: options.context,
        temperature: 0, seed: 42, outputLimit: GROUP_SEMANTIC_OUTPUT_TOKENS, inputTruncation: 'unknown' };
    },
  };
}
