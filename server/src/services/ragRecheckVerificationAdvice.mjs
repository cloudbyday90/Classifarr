/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { recoveryField as field, recoveryRows, POLICY_RECOVERY_REFERENCE_LIMITS } from './policyRecoverySuggestionContract.mjs';
import { holdPolicyVerificationAdvice, createPolicyVerificationAdviceSession } from './policyVerificationAdvice.mjs';

const sources = new WeakMap(), stages = new WeakMap(), requests = new WeakMap();

/** Called immediately after successful reevaluation, never from retained/replayed stage data. */
export function holdRagRecheckAdviceSource({ policyResult, metadata, libraries }) {
  try {
    if (field(policyResult, 'action') !== 'prompt_confirm') return null;
    const ranked = field(policyResult, 'ranked');
    const leader = recoveryRows(ranked, POLICY_RECOVERY_REFERENCE_LIMITS.candidates)[0];
    const selected = recoveryRows(libraries, POLICY_RECOVERY_REFERENCE_LIMITS.libraries)
      .find(library => field(library, 'id') === field(leader, 'library_id'));
    const signalContext = Object.freeze({ ranked, confidence: field(policyResult, 'confidence'), suggestedLibrary: selected });
    const args = { policyResult, metadata, libraries, signalContext };
    const advice = holdPolicyVerificationAdvice(args);
    if (!advice) return null;
    const token = Object.freeze({}); sources.set(token, { args, advice }); return token;
  } catch { return null; }
}

function adopted(stage, source, candidate) {
  return field(stage, 'policyAfter') === source.args.policyResult && field(stage, 'hadError') === false &&
    field(field(stage, 'policyGate'), 'shouldAdopt') === true && field(stage, 'pass2Candidate') === candidate &&
    candidate != null && field(candidate, 'policyResult') === source.args.policyResult &&
    field(candidate, 'library') === source.args.signalContext.suggestedLibrary && field(source.args.policyResult, 'action') === 'prompt_confirm';
}

/** Preserve the public stage shape; only an actual successful source can attach a handoff. */
export function retainRagRecheckAdvice(stage, token) {
  try {
    const source = sources.get(token), candidate = field(stage, 'pass2Candidate');
    if (source && adopted(stage, source, candidate)) stages.set(stage, { source, candidate, gate: field(stage, 'policyGate') });
  } catch { /* Optional proof cannot change evaluation, adoption or retry behavior. */ }
  return stage;
}

function consumerMatches(source, context) {
  return field(context, 'suggestedLibrary') === source.args.signalContext.suggestedLibrary &&
    field(context, 'confidence') === source.args.signalContext.confidence;
}

/** Consume once in the already-adopted branch; shape copies cannot reuse the association. */
export function takeRagRecheckAdvice(stage, { policyResult, metadata, libraries, signalContext, candidate }) {
  try {
    const value = stages.get(stage); stages.delete(stage);
    if (!value || value.candidate !== candidate || field(stage, 'policyGate') !== value.gate || !adopted(stage, value.source, candidate) ||
        value.source.args.policyResult !== policyResult || value.source.args.metadata !== metadata ||
        value.source.args.libraries !== libraries || !consumerMatches(value.source, signalContext)) return null;
    const token = Object.freeze({}); requests.set(token, { ...value, stage, metadata, libraries, signalContext }); return token;
  } catch { return null; }
}

/** A fresh source context plus an additional guard; authority/parsing context stays untouched. */
export function createRagRecheckAdviceSession(token, args) {
  const value = requests.get(token);
  requests.delete(token);
  if (!value) return createPolicyVerificationAdviceSession(null, args);
  return createPolicyVerificationAdviceSession(value.source.advice, value.source.args, () =>
    value.metadata === args.metadata && value.libraries === args.libraries && value.signalContext === args.signalContext &&
    field(value.stage, 'policyGate') === value.gate && adopted(value.stage, value.source, value.candidate) && consumerMatches(value.source, args.signalContext));
}
