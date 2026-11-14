/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { recoveryField as field, recoveryRows, POLICY_RECOVERY_REFERENCE_LIMITS } from './policyRecoverySuggestionContract.mjs';
import { holdPolicyRecoverySuggestion, readPolicyRecoverySuggestion } from './policyRecoverySuggestionReader.mjs';
import { captureCurrentPolicyReviewSeed } from './currentPolicyReviewFrameSeed.mjs';
import { associateCurrentPolicyReviewCandidate } from './currentPolicyReviewFrameLive.mjs';

const sources = new WeakMap();
const stages = new WeakMap();
const prepared = new WeakMap();

/** Capture numeric review evidence before adoption callbacks and optional prompt work. */
export function holdAdoptedCurrentPolicyReviewSource({ policyResult, metadata, libraries }) {
  try {
    if (field(policyResult, 'action') !== 'prompt_confirm') return null;
    const ranked = field(policyResult, 'ranked');
    const leader = recoveryRows(ranked, POLICY_RECOVERY_REFERENCE_LIMITS.candidates)[0];
    const library = recoveryRows(libraries, POLICY_RECOVERY_REFERENCE_LIMITS.libraries)
      .find(row => field(row, 'id') === field(leader, 'library_id'));
    const signalContext = Object.freeze({ ranked, confidence: field(policyResult, 'confidence'), suggestedLibrary: library });
    const args = { policyResult, metadata, libraries, signalContext };
    const selection = holdPolicyRecoverySuggestion(args);
    if (!selection || readPolicyRecoverySuggestion(selection, args) !== library) return null;
    const token = Object.freeze({});
    sources.set(token, { args, selection, library, seed: captureCurrentPolicyReviewSeed(policyResult, metadata) });
    return token;
  } catch {
    return null;
  }
}

function adopted(value) {
  return field(value.stage, 'policyAfter') === value.source.args.policyResult &&
    field(value.stage, 'hadError') === false && field(value.stage, 'policyGate') === value.gate &&
    field(value.gate, 'shouldAdopt') === true && field(value.stage, 'pass2Candidate') === value.candidate &&
    field(value.candidate, 'policyResult') === value.source.args.policyResult &&
    field(value.candidate, 'library') === value.source.library && field(value.candidate, 'method') === 'policy_recheck' &&
    field(value.candidate, 'confidence') === value.confidence;
}

/** Only the actual successful adopted stage receives the source association. */
export function retainAdoptedCurrentPolicyReviewStage(stage, token, scope) {
  try {
    const source = sources.get(token);
    sources.delete(token);
    const { policyResult, metadata } = scope ?? source?.args ?? {};
    const candidate = field(stage, 'pass2Candidate');
    if (!candidate || field(stage, 'policyAfter') !== policyResult || field(stage, 'hadError') !== false ||
        field(field(stage, 'policyGate'), 'shouldAdopt') !== true || field(policyResult, 'action') !== 'prompt_confirm') return stage;
    // Inspection failure must remain a present gap, never an absent legacy fallback.
    associateCurrentPolicyReviewCandidate(candidate, { seed: null, current: () => false, policyResult, metadata });
    const confidence = field(candidate, 'confidence');
    const value = source && typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 100
      ? { source, stage, candidate, confidence, gate: field(stage, 'policyGate'), invalid: false } : null;
    if (value && (source.args.policyResult !== policyResult || source.args.metadata !== metadata ||
        (scope && source.args.libraries !== scope.libraries))) value.invalid = true;
    if (policyCurrent(value)) stages.set(stage, value);
    // This association belongs to policy adoption, independently of optional AI work.
    associateCurrentPolicyReviewCandidate(candidate, {
      seed: value?.source.seed ?? null, current: () => policyCurrent(value), policyResult, metadata,
    });
  } catch { /* A diagnostic gap cannot change candidate adoption. */ }
  return stage;
}

function policyCurrent(value) {
  if (!value || value.invalid) return false;
  try {
    if (adopted(value) && readPolicyRecoverySuggestion(value.source.selection, value.source.args) === value.source.library) return true;
  } catch { /* Latch an observed inspection failure for this review attempt. */ }
  value.invalid = true;
  return false;
}

function current(observed) {
  if (!observed || observed.invalid) return false;
  try {
    if (policyCurrent(observed.value) &&
        field(observed.signalContext, 'suggestedLibrary') === observed.value.source.library &&
        field(observed.signalContext, 'confidence') === observed.value.source.args.signalContext.confidence) return true;
  } catch { /* Invocation inspection failure cannot admit or replace provider work. */ }
  observed.invalid = true;
  return false;
}

/** Consume after existing invocation gates. Missing proof still creates a gap observer. */
export function prepareAdoptedCurrentPolicyReview(stage, { policyResult, metadata, libraries, signalContext, candidate }) {
  const value = stages.get(stage);
  stages.delete(stage);
  const observed = { value, signalContext, policyResult, metadata, invalid: false };
  if (value) {
    if (value.source.args.policyResult !== policyResult || value.source.args.metadata !== metadata ||
        value.source.args.libraries !== libraries || value.candidate !== candidate) observed.invalid = true;
  }
  current(observed);
  const token = Object.freeze({});
  prepared.set(token, observed);
  return token;
}

/** Fulfilled provider observations retain their ordinary lifecycle even when review proof is lost. */
export function retainAdoptedCurrentPolicyReview(token, candidate) {
  const observed = prepared.get(token);
  prepared.delete(token);
  if (!observed) return candidate;
  current(observed);
  return associateCurrentPolicyReviewCandidate(candidate, {
    seed: observed.value?.source.seed ?? null,
    current: () => current(observed),
    policyResult: observed.policyResult,
    metadata: observed.metadata,
  });
}
