/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { recoveryField as field, recoveryRows, POLICY_RECOVERY_REFERENCE_LIMITS } from './policyRecoverySuggestionContract.mjs';
import { holdPolicyRecoverySuggestion, readPolicyRecoverySuggestion } from './policyRecoverySuggestionReader.mjs';

const sources = new WeakMap();

/** Result ownership is independent of optional advice, invocation permission and review capture. */
export function holdAdoptedRagResultContextSource({ policyResult, metadata, libraries }) {
  try {
    const action = field(policyResult, 'action');
    if (!['auto_classify', 'prompt_confirm', 'prompt_select'].includes(action)) return null;
    const method = action === 'auto_classify' ? 'policy_auto' : 'policy_recheck';
    const ranked = field(policyResult, 'ranked');
    const leader = recoveryRows(ranked, POLICY_RECOVERY_REFERENCE_LIMITS.candidates)[0];
    const library = recoveryRows(libraries, POLICY_RECOVERY_REFERENCE_LIMITS.libraries)
      .find(row => field(row, 'id') === field(leader, 'library_id'));
    const signalContext = Object.freeze({ ranked, confidence: field(policyResult, 'confidence'), suggestedLibrary: library });
    const args = { policyResult, metadata, libraries, signalContext };
    const selection = holdPolicyRecoverySuggestion(args);
    if (!selection || readPolicyRecoverySuggestion(selection, args) !== library) return null;
    const token = Object.freeze({});
    sources.set(token, { args, action, method, selection, library });
    return token;
  } catch { return null; }
}

/** Consume only at actual adopted candidate construction; no continuing freshness lease is created. */
export function applyAdoptedRagResultContext(stage, token, { policyResult, metadata, libraries }) {
  const source = sources.get(token);
  sources.delete(token);
  try {
    const candidate = field(stage, 'pass2Candidate');
    const confidence = field(candidate, 'confidence');
    if (!source || field(policyResult, 'action') !== source.action ||
        source.args.policyResult !== policyResult || source.args.metadata !== metadata ||
        source.args.libraries !== libraries || field(stage, 'policyAfter') !== policyResult ||
        field(stage, 'hadError') !== false || field(field(stage, 'policyGate'), 'shouldAdopt') !== true ||
        field(candidate, 'policyResult') !== policyResult || field(candidate, 'library') !== source.library ||
        field(candidate, 'method') !== source.method || typeof confidence !== 'number' ||
        !Number.isFinite(confidence) || confidence < 0 || confidence > 100 ||
        readPolicyRecoverySuggestion(source.selection, source.args) !== source.library) return stage;
    // The owned builder already cleared earlier support. Refuse accessor output slots.
    field(candidate, 'signalContext');
    Object.defineProperty(candidate, 'signalContext', { value: source.args.signalContext,
      enumerable: true, configurable: true, writable: true });
  } catch { /* Unavailable support cannot alter adoption or replace an operation error. */ }
  return stage;
}
