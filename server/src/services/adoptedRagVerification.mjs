/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { recoveryField as field, recoveryRows, POLICY_RECOVERY_REFERENCE_LIMITS } from './policyRecoverySuggestionContract.mjs';
import { holdPolicyRecoverySuggestion, readPolicyRecoverySuggestion } from './policyRecoverySuggestionReader.mjs';
import { createAdoptedRagVerificationRefusal } from './adoptedRagVerificationRefusal.mjs';
import { associateCurrentPolicyReviewCandidate } from './currentPolicyReviewFrameLive.mjs';

const sources = new WeakMap(), stages = new WeakMap(), prepared = new WeakMap();
function display(library) {
  const name = field(library, 'name');
  if (typeof name !== 'string') throw createAdoptedRagVerificationRefusal();
  return name.slice(0, 160);
}

/** Invocation authority is independent of optional advice and saved-review diagnostics. */
export function holdAdoptedRagVerificationSource({ policyResult, metadata, libraries }) {
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
    sources.set(token, { args, library, selection, display: display(library) });
    return token;
  } catch { return null; }
}

function adopted(value) {
  return field(value.stage, 'policyAfter') === value.source.args.policyResult &&
    field(value.stage, 'hadError') === false && field(value.stage, 'policyGate') === value.gate &&
    field(value.gate, 'shouldAdopt') === true && field(value.stage, 'pass2Candidate') === value.candidate &&
    field(value.candidate, 'policyResult') === value.source.args.policyResult &&
    field(value.candidate, 'library') === value.source.library && field(value.candidate, 'method') === 'policy_recheck' &&
    field(value.candidate, 'confidence') === value.confidence;
}

export function retainAdoptedRagVerificationStage(stage, token) {
  try {
    const source = sources.get(token);
    sources.delete(token);
    if (!source) return stage;
    const candidate = field(stage, 'pass2Candidate'), confidence = field(candidate, 'confidence');
    const value = { source, stage, candidate, confidence, gate: field(stage, 'policyGate'), invalid: false, entered: false };
    if (typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 100 && adopted(value)) stages.set(stage, value);
  } catch { /* Missing provenance does not change policy adoption. */ }
  return stage;
}

function current(value) {
  if (!value || value.invalid) return false;
  try {
    if (adopted(value) && readPolicyRecoverySuggestion(value.source.selection, value.source.args) === value.source.library &&
        display(value.source.library) === value.source.display) return true;
  } catch { /* Inspection failures latch refusal for this invocation. */ }
  value.invalid = true;
  return false;
}

/** Consume only after the existing eligibility and deterministic-mode checks. */
export function prepareAdoptedRagVerification(stage, { policyResult, metadata, libraries, candidate }) {
  try {
    const value = stages.get(stage);
    stages.delete(stage);
    if (!value || value.source.args.policyResult !== policyResult || value.source.args.metadata !== metadata ||
        value.source.args.libraries !== libraries || value.candidate !== candidate || !current(value)) return null;
    const token = Object.freeze({}), verificationCandidate = Object.freeze({ library_id: field(value.source.library, 'id') });
    value.verificationCandidate = verificationCandidate;
    prepared.set(token, value);
    return Object.freeze({ token, candidate: verificationCandidate, signalContext: value.source.args.signalContext });
  } catch { return null; }
}

export function acceptAdoptedRagVerification(token) {
  const value = prepared.get(token);
  if (!value?.entered || !current(value)) throw createAdoptedRagVerificationRefusal();
}

export function enterAdoptedRagVerification(token, { metadata, libraries, signalContext }, candidate) {
  const value = prepared.get(token);
  if (!value || value.entered || value.source.args.metadata !== metadata || value.source.args.libraries !== libraries ||
      value.source.args.signalContext !== signalContext || value.verificationCandidate !== candidate || !current(value)) {
    if (value) value.invalid = true;
    throw createAdoptedRagVerificationRefusal();
  }
  value.entered = true;
  return { assertCurrent: () => acceptAdoptedRagVerification(token) };
}

/** A new freshness refusal must not let the absent-frame reader revive pass-one advice. */
export function retainAdoptedRagVerificationGap(candidate, { policyResult, metadata }) {
  return associateCurrentPolicyReviewCandidate(candidate, { seed: null, current: () => false, policyResult, metadata });
}
