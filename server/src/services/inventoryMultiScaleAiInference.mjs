/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DESCRIPTION_BENCHMARK_OUTPUT_TOKENS } from './localDescriptionBenchmarkClient.mjs';
import { parseMultiScaleAiChoice } from './inventoryMultiScaleAiCase.mjs';
import { parseIndependentFit, chooseIndependentFit } from './inventoryIndependentFitContract.mjs';
import { runInventoryAiPass } from './inventoryAiInferencePass.mjs';

const armStats = name => ({ name, calls: 0, validPasses: 0, latencyMs: 0, promptTokens: 0, outputTokens: 0 });

/** Paired passes, stopping rather than silently repairing invalid/provider output. */
export function createMultiScaleAiInference(options, { client, identity, signal, onProgress, independentFit = false } = {}) {
  const arms = [armStats('raw'), armStats(independentFit ? 'independent' : 'compact')], failures = {};
  const assessments = { empty: 0, grades: [0, 0, 0, 0], compared: 0, changed: 0, casesWithChangedGrades: 0 };
  let attemptedCases = 0, completePairs = 0, failed = false;
  const fail = status => { failed = true; failures[status] = (failures[status] ?? 0) + 1; };
  return {
    async compare(plan, prompts, ordinal) {
      if (failed || signal?.aborted || attemptedCases >= options.generateCases) return null;
      if (independentFit) {
        chooseIndependentFit(plan.candidates, plan.candidates.map(() => 0));
        if (!Array.isArray(prompts[1]) || prompts[1].length !== 2 || [...prompts[1]].some(pass =>
          !Array.isArray(pass) || pass.length !== plan.candidates.length || [...pass].some(prompt =>
            prompt !== null && (typeof prompt !== 'string' || !prompt.length)))) throw new Error('independent_fit_packet_invalid');
      }
      attemptedCases++;
      const choices = [[], []], assessmentPasses = [];
      // Counterbalance arm order and candidate-order timing independently across cases.
      for (let offset = 0; offset < 2; offset++) {
        const armIndex = (ordinal + offset) % 2, stats = arms[armIndex];
        for (let pass = 0; pass < 2; pass++) {
          const reverse = (Math.floor(ordinal / 2) + pass) % 2;
          try {
            const independent = independentFit && armIndex === 1, grades = [];
            const inputs = independent ? prompts[armIndex][reverse] : [prompts[armIndex][reverse]];
            for (const prompt of inputs) {
              signal?.throwIfAborted();
              if (independent && prompt === null) { grades.push(0); assessments.empty++; continue; }
              const result = await runInventoryAiPass({ client, identity, signal, context: options.context, prompt, stats,
                count: independent ? 1 : plan.candidates.length, responseContract: independent ? 'independent_fit' : 'candidate',
                parse: independent ? parseIndependentFit : response => parseMultiScaleAiChoice(response, plan.candidates, reverse === 1) });
              if (result.failure) { fail(result.failure); return null; }
              grades.push(result.value);
              if (independent) assessments.grades[result.value]++;
              onProgress?.({ stage: 'multi_scale_ai_inference', attemptedCases, completePairs, calls: arms.reduce((sum, arm) => sum + arm.calls, 0) });
            }
            if (independent) {
              const canonical = reverse ? [...grades].reverse() : grades;
              assessmentPasses[reverse] = canonical;
              choices[armIndex][reverse] = chooseIndependentFit(plan.candidates, canonical);
            } else choices[armIndex][reverse] = grades[0];
          } catch { fail(signal?.aborted ? 'interrupted' : 'provider_failed'); return null; }
        }
      }
      if (independentFit) {
        const changed = assessmentPasses[0].filter((grade, index) => grade !== assessmentPasses[1][index]).length;
        assessments.compared += plan.candidates.length; assessments.changed += changed;
        assessments.casesWithChangedGrades += Number(changed > 0);
      }
      completePairs++;
      return choices.map(([forward, reverse]) => forward !== reverse ? { status: 'order_sensitive' }
        : forward === null ? { status: 'abstained' } : { status: 'selected', id: forward });
    },
    read() {
      return { status: signal?.aborted ? 'interrupted' : failed ? 'completed_with_errors' : options.generateCases ? 'complete' : 'preflight',
        calls: arms.reduce((sum, arm) => sum + arm.calls, 0), attemptedCases, completePairs, failures: { ...failures }, arms: structuredClone(arms),
        requestedGenerationCases: options.generateCases, maximumCalls: options.generateCases * (independentFit ? 8 : 4),
        ...(independentFit ? { assessments: structuredClone(assessments) } : {}),
        model: identity?.model ?? null, digest: identity?.digest ?? null, context: options.context, temperature: 0, seed: 42,
        outputLimit: DESCRIPTION_BENCHMARK_OUTPUT_TOKENS, inputTruncation: 'unknown' };
    },
  };
}
