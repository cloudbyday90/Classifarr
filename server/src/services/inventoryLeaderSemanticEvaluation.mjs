/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareSemanticComparisonPlan, buildSemanticComparisonPrompt, parseSemanticComparisonResponse,
  SEMANTIC_COMPARISON_OUTPUT_TOKENS } from './inventorySemanticComparisonContract.mjs';
import { buildLeaderSemanticReport } from './inventoryLeaderSemanticReport.mjs';
import { buildGroundedComparisonPrompt, groundedComparisonOutputTokens } from './inventoryGroundedComparisonContract.mjs';
import { runGroundedComparisonTrial } from './inventoryGroundedComparisonTrial.mjs';
import { DiscoveryDeferredError } from './inventoryDiscoveryAdmission.mjs';

export const LEADER_SEMANTIC_MAX_CASES = 32;

/** Retention and selection do not observe model output; source sample order is deterministic. */
export function createLeaderSemanticEvaluation(options) {
  if (!Number.isInteger(options?.generateCases) || options.generateCases < 0 || options.generateCases > LEADER_SEMANTIC_MAX_CASES ||
      ![8192, 16384, 32768, 65536].includes(options.context) ||
      (options.grounded !== undefined && typeof options.grounded !== 'boolean')) throw new Error('leader_semantic_options_invalid');
  const pending = [], excluded = {};
  let eligible = 0, bytes = 0;
  const exclude = reason => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
  return {
    add(input) {
      eligible++;
      if (pending.length >= 64) { exclude('retention_budget'); return; }
      let plan;
      try { plan = prepareSemanticComparisonPlan(input); }
      catch { exclude('evidence_unavailable'); return; }
      const prompts = [false, true].map(reverse => buildSemanticComparisonPrompt(plan, reverse));
      if (options.grounded) prompts.push(...[false, false, true].map(reverse => buildGroundedComparisonPrompt(plan, reverse)));
      if (prompts.some((prompt, index) => Buffer.byteLength(prompt) > (options.context -
        (index < 2 ? SEMANTIC_COMPARISON_OUTPUT_TOKENS : groundedComparisonOutputTokens(plan.candidates.length))) * 3)) {
        exclude('context_budget'); return;
      }
      const size = prompts.reduce((sum, prompt) => sum + Buffer.byteLength(prompt), 0);
      if (bytes + size > 4_000_000) { exclude('retention_budget'); return; }
      bytes += size;
      pending.push({ plan, prompts, kind: input.kind, mediaType: plan.query.mediaType,
        observed: [...input.observed], baselineId: input.baselineId, vetoed: input.vetoed === true });
    },
    async run({ createClient, signal, checkpoint = () => {}, onProgress = () => {}, onGenerationCall = () => {} }) {
      signal?.throwIfAborted();
      // Round-robin kinds/media before model results, including the withheld-library controls.
      const groups = ['withheld_library', 'ambiguous_nomination'].flatMap(kind => ['movie', 'tv']
        .map(type => pending.filter(row => row.kind === kind && row.mediaType === type)));
      const rows = [];
      while (rows.length < LEADER_SEMANTIC_MAX_CASES && groups.some(group => group.length)) {
        for (const group of groups) if (group.length && rows.length < LEADER_SEMANTIC_MAX_CASES) rows.push({ ...group.shift(), status: 'not_run', attempted: false });
      }
      let client, identity, calls = 0, failed = false;
      const usage = { latencyMs: 0, promptTokens: 0, outputTokens: 0 };
      for (const row of rows.slice(0, options.generateCases)) {
        checkpoint(); signal?.throwIfAborted(); row.attempted = true;
        try {
          if (!client) { client = createClient(); identity = await client.inspect(signal); }
          if (options.grounded) {
            failed = !await runGroundedComparisonTrial(row, { client, identity, options, signal, usage, checkpoint,
              onGenerationCall: () => { calls++; onGenerationCall(); } });
          } else {
            const choices = [];
            for (const [index, prompt] of row.prompts.entries()) {
              signal?.throwIfAborted();
              const result = await client.generate({ prompt, count: row.plan.candidates.length, context: options.context,
                identity, signal, responseContract: 'library_comparison', onGenerationCall: () => { calls++; onGenerationCall(); } });
              signal?.throwIfAborted();
              for (const field of Object.keys(usage)) usage[field] += result[field];
              const selected = parseSemanticComparisonResponse(result.response, row.plan.candidates.length);
              if (result.outputLimitReached || result.contextLimitSuspected || selected === null) {
                row.status = result.outputLimitReached ? 'output_limit' : result.contextLimitSuspected ? 'context_limit' : 'invalid_response';
                failed = true; break;
              }
              const candidates = index ? [...row.plan.candidates].reverse() : row.plan.candidates;
              choices.push(selected === 0 ? null : candidates[selected - 1].id);
            }
            if (!failed) {
              row.status = choices[0] !== choices[1] ? 'order_sensitive' : choices[0] === null ? 'abstained' : 'supported';
              row.before = row.observed.includes(row.baselineId); row.after = row.observed.includes(choices[0]);
            }
          }
        } catch (error) {
          signal?.throwIfAborted();
          if (error instanceof DiscoveryDeferredError) throw error;
          row.status = 'provider_failed'; failed = true;
        }
        onProgress({ stage: 'leader_semantic_comparison', calls, completed: rows.filter(value => value.attempted).length });
        checkpoint(); signal?.throwIfAborted();
        if (failed) break; // No repair loop, fallback, or further calls following a provider/protocol failure.
      }
      return buildLeaderSemanticReport(rows, { eligible, retained: pending.length, excluded, calls, identity, options, usage, failed });
    },
  };
}
