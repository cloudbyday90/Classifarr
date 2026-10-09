/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withoutInferredProfileSources } from './heldOutSemanticStudyPreparation.mjs';
import { isNativePolicyRuntimeAuthority } from './policyEngineRuntimeAuthority.mjs';
import { isInferredProfilePurposeRule } from './policyInferredPurposeAdmission.mjs';
import { buildPolicyLibraryProfileInitialIntentContract } from './policyLibraryProfileInitialIntent.mjs';
import { validatePolicyIntentContract } from './policyIntentSchema.mjs';
import { isPolicyProfileDerivedPurposeRule } from './policyDeclaredPurposeProvenance.mjs';

// Synthetic fold observations are computed now, not deployed profile timestamps.
// A fixed private clock avoids wall-clock drift in otherwise identical experiments.
const FOLD_CLOCK = '1970-01-01T00:00:00.000Z';

function rebuild(original, stripped, profiles) {
  const contract = original.policy_intent_contract;
  if (!isNativePolicyRuntimeAuthority(original) || original.policy_runtime_authority.validationOk !== true ||
      contract?.validation?.valid !== true || !Array.isArray(contract.purpose) || !contract.purpose.length ||
      !contract.purpose.every(isInferredProfilePurposeRule) ||
      [contract.hard_limits, contract.avoid].some(rules => rules?.some(isPolicyProfileDerivedPurposeRule))) return stripped;
  const profile = profiles.get(original.library_id)?.profile;
  if (!profile || !['movie', 'tv'].includes(profile.media_type) || profile.media_type !== original.library_media_type) return stripped;
  const generated = buildPolicyLibraryProfileInitialIntentContract({
    policy: { ...stripped, libraryProfile: { ...profile, last_generated_at: FOLD_CLOCK } }, now: new Date(FOLD_CLOCK),
  });
  if (!generated.ready) return stripped;
  const types = new Set(contract.purpose.map(rule => rule.signal_type));
  const replacement = { ...stripped.policy_intent_contract,
    purpose: generated.contract.purpose.filter(rule => types.has(rule.signal_type)) };
  replacement.validation = validatePolicyIntentContract(replacement);
  return replacement.validation.valid ? { ...stripped, policy_intent_contract: replacement } : stripped;
}

/** Per-arm lifetime only. Stored inferred values and query labels never train a purpose. */
export function createFoldInferredPolicyPurpose(policies) {
  const stripped = policies.map(withoutInferredProfileSources), cache = new WeakMap();
  return {
    withoutTraining: stripped,
    forProfiles(profiles) {
      if (!(profiles instanceof Map)) throw new Error('fold_policy_profiles_missing');
      if (!cache.has(profiles)) cache.set(profiles, policies.map((policy, index) => rebuild(policy, stripped[index], profiles)));
      return cache.get(profiles);
    },
  };
}
