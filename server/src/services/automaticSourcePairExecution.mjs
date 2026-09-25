/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computeAutomaticSourcePair } from './automaticSourcePairComputation.mjs';
import { evaluateSourceDescriptionPair } from './sourceDescriptionPairedEvaluation.mjs';
import { evaluateAutomaticPolicyReplay } from './automaticPolicyReplay.mjs';

/** Keep prepared arms private and reuse them, rather than repeating retrieval and profile fitting. */
export async function executeAutomaticSourcePair(snapshot, state) {
  const started = performance.now(), arms = [];
  const result = computeAutomaticSourcePair(snapshot, state, { evaluate: (source, identity, options, context) =>
    evaluateSourceDescriptionPair(source, identity, options, { ...context, onPreparedArm: arm => arms.push(arm) }) });
  if (!result.unchanged && snapshot.inputs.source.policies) {
    const policyReplay = await evaluateAutomaticPolicyReplay(snapshot.inputs.source, arms, result.report);
    result.report = { ...result.report, version: 'automatic_source_pair.v2', policyReplay,
      durationMs: Math.ceil(performance.now() - started) };
  }
  return result;
}
