/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { recoveryField as field, recoveryRows, POLICY_RECOVERY_REFERENCE_LIMITS } from './policyRecoverySuggestionContract.mjs';
import { holdPolicyRecoverySuggestion, readPolicyRecoverySuggestion } from './policyRecoverySuggestionReader.mjs';
import { holdPolicyVerificationAdvice, createPolicyVerificationAdviceSession } from './policyVerificationAdvice.mjs';
import { createNonadoptedRagVerificationRefusal } from './nonadoptedRagVerificationRefusal.mjs';
import { captureCurrentPolicyReviewSeed } from './currentPolicyReviewFrameSeed.mjs';
import { associateCurrentPolicyReviewCandidate } from './currentPolicyReviewFrameLive.mjs';

const sources = new WeakMap(), stages = new WeakMap(), prepared = new WeakMap();
function label(library) {
  const value = field(library, 'name');
  if (typeof value !== 'string') throw createNonadoptedRagVerificationRefusal();
  return value.slice(0, 160); // Existing verification display prefix, independent of optional full-label admission.
}

/** Numeric live selection is authority evidence here; optional profile/text admission is separate. */
export function holdNonadoptedRagVerificationSource({ policyResult, metadata, libraries }) {
  try {
    if (field(policyResult, 'action') !== 'prompt_confirm') return null;
    const ranked = field(policyResult, 'ranked'), leader = recoveryRows(ranked, POLICY_RECOVERY_REFERENCE_LIMITS.candidates)[0];
    const library = recoveryRows(libraries, POLICY_RECOVERY_REFERENCE_LIMITS.libraries).find(row => field(row, 'id') === field(leader, 'library_id'));
    const signalContext = Object.freeze({ ranked, confidence: field(policyResult, 'confidence'), suggestedLibrary: library });
    const args = { policyResult, metadata, libraries, signalContext }, selection = holdPolicyRecoverySuggestion(args);
    if (!selection || readPolicyRecoverySuggestion(selection, args) !== library) return null;
    const token = Object.freeze({});
    sources.set(token, { args, selection, library, display: label(library), advice: holdPolicyVerificationAdvice(args),
      reviewSeed: captureCurrentPolicyReviewSeed(policyResult, metadata) });
    return token;
  } catch { return null; }
}

function nonadopted(stage, source, gate) {
  return field(stage, 'policyAfter') === source.args.policyResult && field(stage, 'hadError') === false &&
    field(stage, 'policyGate') === gate && field(gate, 'shouldAdopt') === false && field(stage, 'pass2Candidate') === null;
}

/** Only the actual fulfilled evaluation can attach this private stage association. */
export function retainNonadoptedRagVerification(stage, token) {
  try {
    const source = sources.get(token); sources.delete(token);
    const gate = field(stage, 'policyGate');
    if (source && nonadopted(stage, source, gate)) stages.set(stage, { source, gate });
  } catch { /* A proof gap cannot change evaluation/adoption or trigger another evaluation. */ }
  return stage;
}

function current(value) {
  try {
    if (!value || value.invalidated) return false;
    const valid = nonadopted(value.stage, value.source, value.gate) &&
      readPolicyRecoverySuggestion(value.source.selection, value.source.args) === value.source.library &&
      label(value.source.library) === value.source.display;
    if (!valid) value.invalidated = true;
    return valid;
  } catch { if (value) value.invalidated = true; return false; }
}

/** Consume once after the existing eligibility/mode gates, before charging an AI-service invocation. */
export function prepareNonadoptedRagVerification(stage, { policyResult, metadata, libraries }) {
  try {
    const held = stages.get(stage); stages.delete(stage);
    if (!held || held.source.args.policyResult !== policyResult || held.source.args.metadata !== metadata || held.source.args.libraries !== libraries) return null;
    const value = { ...held, stage, invalidated: false, entered: false };
    if (!current(value)) return null;
    const token = Object.freeze({}), candidate = Object.freeze({ library_id: field(value.source.library, 'id') });
    value.candidate = candidate; prepared.set(token, value);
    return Object.freeze({ token, candidate, signalContext: value.source.args.signalContext });
  } catch { return null; }
}

/** Trusted refusal is private identity, never an error code/message supplied by a provider. */
export function acceptNonadoptedRagVerification(token) {
  const value = prepared.get(token);
  if (!value?.entered || !current(value)) {
    if (value) value.invalidated = true;
    throw createNonadoptedRagVerificationRefusal();
  }
}

export function enterNonadoptedRagVerification(token, { metadata, libraries, signalContext }, candidate) {
  const value = prepared.get(token);
  if (!value || value.entered || value.source.args.metadata !== metadata || value.source.args.libraries !== libraries ||
      value.source.args.signalContext !== signalContext || value.candidate !== candidate || !current(value)) {
    if (value) value.invalidated = true;
    throw createNonadoptedRagVerificationRefusal();
  }
  value.entered = true;
  return {
    assertCurrent: () => acceptNonadoptedRagVerification(token),
    advice: createPolicyVerificationAdviceSession(value.source.advice, value.source.args, () => current(value)),
  };
}

export function retainNonadoptedCurrentPolicyReview(token, candidate) {
  const value = prepared.get(token);
  if (!value?.entered) return candidate;
  return associateCurrentPolicyReviewCandidate(candidate, { seed: value.source.reviewSeed,
    current: () => current(value), policyResult: value.source.args.policyResult, metadata: value.source.args.metadata });
}
