/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { readSelectedClassificationLibraryId } from './classificationSelectedLibrary.mjs';
import { validatePolicyRuntimeQuestionReduction } from './policyRuntimeQuestionReduction.mjs';

const bindings = new WeakMap();

function serializeProof(handoff) {
  try {
    return JSON.stringify(handoff);
  } catch {
    return null;
  }
}

export function bindNativeQuestionHandoff(handoff, result, libraryId, { refused = false } = {}) {
  bindings.set(handoff, {
    result, libraryId, plan: handoff.plan, queueQuestionReduction: handoff.queueQuestionReduction, refused,
    proof: serializeProof(handoff),
  });
  return handoff;
}

export function hasNativeQuestionHandoffBinding(handoff) {
  return bindings.has(handoff);
}

export function hasCurrentNativeQuestionHandoffBinding(handoff, result) {
  const binding = bindings.get(handoff);
  return Boolean(binding && !binding.refused && binding.result === result &&
    binding.libraryId !== null && binding.libraryId === readSelectedClassificationLibraryId(result.library) &&
    binding.plan === handoff.plan && binding.queueQuestionReduction === handoff.queueQuestionReduction &&
    binding.proof !== null && binding.proof === serializeProof(handoff) &&
    validatePolicyRuntimeQuestionReduction(handoff.plan).ok === true);
}
