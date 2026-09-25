/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computeAutomaticSourcePair } from './automaticSourcePairComputation.mjs';
import { evaluateSourceDescriptionPair } from './sourceDescriptionPairedEvaluation.mjs';
import { evaluateAutomaticPolicyReplay } from './automaticPolicyReplay.mjs';
import { replayCachedAdjudication } from './cachedAdjudicationReplay.mjs';
import { createCachedAdjudicationReport } from './cachedAdjudicationReport.mjs';

/** Keep prepared arms private and reuse them, rather than repeating retrieval and profile fitting. */
export async function executeAutomaticSourcePair(snapshot, state, { includePlan = false } = {}) {
  const started = performance.now(), arms = [];
  const result = computeAutomaticSourcePair(snapshot, includePlan ? { ...state, input_fingerprint: null } : state, { evaluate: (source, identity, options, context) =>
    evaluateSourceDescriptionPair(source, identity, options, { ...context, onPreparedArm: arm => arms.push(arm) }) });
  if (!result.unchanged && snapshot.inputs.source.policies) {
    let aiReplay = createCachedAdjudicationReport(), plan = [];
    const policyReplay = await evaluateAutomaticPolicyReplay(snapshot.inputs.source, arms, result.report, {
      onOutcomes: async (outcomes, corrections) => {
        aiReplay = await replayCachedAdjudication(outcomes, corrections, snapshot.inputs.source,
          { onPlan: value => { plan = value; } });
      },
    });
    if (includePlan) result.plan = plan;
    result.report = { ...result.report, version: 'automatic_source_pair.v3', policyReplay, aiReplay,
      durationMs: Math.ceil(performance.now() - started) };
  }
  return result;
}
