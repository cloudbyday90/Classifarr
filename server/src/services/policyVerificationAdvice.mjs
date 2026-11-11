/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { holdPolicyRecoverySuggestion, readPolicyRecoverySuggestion } from './policyRecoverySuggestionReader.mjs';
import { recoveryField as field } from './policyRecoverySuggestionContract.mjs';
import { projectVerificationAdvice, projectVerificationProfile, boundVerificationAdvice } from './policyVerificationAdviceProjection.mjs';

const held = new WeakMap();
const absent = Object.freeze({}); // Truthy: the shared formatter must not fall back to raw signalContext.

/** Independent consumer: the reused live witness proves selection, not the whole signal packet. */
export function holdPolicyVerificationAdvice(args) {
  try {
    const selection = holdPolicyRecoverySuggestion(args), library = readPolicyRecoverySuggestion(selection, args);
    if (!library) return null;
    const advice = projectVerificationAdvice(library, field(args.signalContext, 'confidence'));
    const token = Object.freeze({});
    held.set(token, { args: { ...args }, selection, library, advice });
    return token;
  } catch { return null; }
}

/** Scope is explicit even for a missing token; private evidence never falls through to legacy advice. */
export function createPolicyVerificationAdviceSession(token, { metadata, libraries, signalContext }) {
  let profile = null;
  let invalidated = false;
  const read = () => {
    try {
      if (invalidated) return null;
      const value = held.get(token);
      const valid = value && value.args.metadata === metadata && value.args.libraries === libraries &&
        value.args.signalContext === signalContext && readPolicyRecoverySuggestion(value.selection, value.args) === value.library &&
        field(value.library, 'name') === value.advice.suggestedLibrary.name;
      if (!valid) invalidated = true;
      return valid ? value : null;
    } catch { invalidated = true; return null; }
  };
  const project = () => {
    const value = read();
    return value ? boundVerificationAdvice(value.advice, profile) : { policySignals: absent, libraryProfile: null };
  };
  return {
    async readProfile(lookup) {
      const value = read();
      if (!value) return;
      const stats = await lookup(field(value.library, 'id'));
      if (read() === value) profile = projectVerificationProfile(stats);
    },
    async buildPrompt(context, build) {
      const sections = project();
      const prompt = await build({ ...context, ...sections });
      if (!sections.policySignals.suggestedLibrary || read()) return prompt;
      // One omission rebuild only; immutable sections cannot acquire changed data during assembly.
      return build({ ...context, policySignals: absent, libraryProfile: null });
    },
  };
}
