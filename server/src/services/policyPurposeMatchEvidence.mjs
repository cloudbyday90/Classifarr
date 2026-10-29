/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { buildPolicyPurposeProvenance, isPolicyDeclaredNativePurposeRule } from './policyDeclaredPurposeProvenance.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';
import { CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';

const VERSION = 'policy.purpose_match_evidence.v1';
const origins = ['declared_native', 'profile_derived', 'mixed', 'unverified'];
const matches = ['matched', 'not_matched', 'not_evaluated', 'no_declared_rules'];
const specificity = ['not_evaluated', 'positive_specialized_evidence', 'broad_compatibility_overlap', 'insufficient_specialized_evidence', 'not_applicable'];
const receipts = new WeakMap();
const context = policy => createHash('sha256').update(JSON.stringify([policy.id, policy.library_id,
  policy.policy_runtime_authority, policy.policy_intent_contract])).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');

export function validPolicyPurposeMatchEvidence(value) {
  return exact(value, ['version', 'mediaType', 'tmdbId', 'policyId', 'libraryId', 'origin', 'declaredMatch', 'runtimeEligible', 'specificity']) &&
    value.version === VERSION && inventoryRankingItemIdentity({ media_type: value.mediaType, tmdb_id: value.tmdbId }) !== null &&
    Number.isInteger(value.policyId) && positiveDatabaseInteger(value.policyId) === value.policyId &&
    Number.isInteger(value.libraryId) && positiveDatabaseInteger(value.libraryId) === value.libraryId &&
    origins.includes(value.origin) && matches.includes(value.declaredMatch) && typeof value.runtimeEligible === 'boolean' &&
    specificity.includes(value.specificity) && (value.declaredMatch !== 'matched' || ['declared_native', 'mixed'].includes(value.origin));
}

/** Synchronous native evaluation only. The injected scorer is the existing pure combination implementation. */
export function buildPolicyPurposeMatchEvidence({ policy, item, runtime, scoreDeclaredRules }) {
  try {
    const authority = policy.policy_runtime_authority, contract = policy.policy_intent_contract;
    if (!inventoryRankingItemIdentity(item) || authority?.sourceId !== 'native_intent' || authority.statusId !== 'native_intent_active' ||
      authority.validationOk !== true || contract?.source !== 'native_intent' || contract.validation?.valid !== true ||
      contract.policy_id !== policy.id || contract.library_id !== policy.library_id) return null;
    const declared = contract.purpose.filter(isPolicyDeclaredNativePurposeRule);
    const evaluated = ['native_intent_runtime_active', 'native_intent_runtime_purpose_not_matched'].includes(runtime.statusId);
    const evidence = Object.freeze({ version: VERSION, mediaType: item.media_type, tmdbId: item.tmdb_id,
      policyId: policy.id, libraryId: policy.library_id, origin: buildPolicyPurposeProvenance(contract.purpose).id,
      declaredMatch: !declared.length ? 'no_declared_rules' : !evaluated ? 'not_evaluated' :
        scoreDeclaredRules(declared) > 50 ? 'matched' : 'not_matched', runtimeEligible: runtime.eligible === true, specificity: 'not_evaluated' });
    if (!validPolicyPurposeMatchEvidence(evidence)) return null;
    receipts.set(evidence, context(policy)); return evidence;
  } catch { return null; /* Diagnostic failure cannot alter scoring/admission. */ }
}

/** Refine only a live minted object under the same loaded contract; legacy flags cannot create proof. */
export function refinePolicyPurposeMatchEvidence(evidence, policy, item, status) {
  try {
    if (!validPolicyPurposeMatchEvidence(evidence) || !receipts.has(evidence) || receipts.get(evidence) !== context(policy) ||
      inventoryRankingItemIdentity(item) !== `${evidence.mediaType}:${evidence.tmdbId}` ||
      evidence.policyId !== policy.id || evidence.libraryId !== policy.library_id || !specificity.includes(status)) return null;
    const refined = Object.freeze({ ...evidence, specificity: status });
    receipts.set(refined, receipts.get(evidence)); return refined;
  } catch { return null; }
}

const unknown = () => Object.freeze({ version: VERSION, origin: 'unverified', declaredMatch: 'not_evaluated',
  runtimeEligible: null, specificity: 'not_evaluated' });

/** Persisted presentation trusts the classifier-owned writer/origin, never arbitrary matching diagnostic JSON. */
export function readPolicyPurposeMatchPresentation({ classification = {}, candidate, sourceMetadata = {} } = {}) {
  const details = sourceMetadata.classification_details, capture = details?.candidate_capture;
  const ranked = details?.ranked_candidates;
  const policyId = positiveDatabaseInteger(candidate?.policy_id), libraryId = positiveDatabaseInteger(candidate?.library_id);
  if (!CLASSIFIER_CAPTURE_METHODS.includes(classification.method) || capture?.version !== 'classification.candidate_capture.v1' ||
    capture.method !== classification.method || capture.stage !== 'pre_routing' || capture.status !== 'recorded' ||
    !['policy_ranked', 'signal_ranked'].includes(capture.source) || !Array.isArray(ranked) || ranked.length > 5 ||
    capture.library_id !== ranked[0]?.library_id || !policyId || !libraryId) return unknown();
  const retained = ranked.find(row => row?.policy_id === policyId && row.library_id === libraryId);
  const value = retained?.candidate_diagnostics?.purpose_evidence;
  if (!validPolicyPurposeMatchEvidence(value) || value.policyId !== policyId || value.libraryId !== libraryId ||
    inventoryRankingItemIdentity(classification) !== `${value.mediaType}:${value.tmdbId}`) return unknown();
  return Object.freeze({ version: VERSION, origin: value.origin, declaredMatch: value.declaredMatch,
    runtimeEligible: value.runtimeEligible, specificity: value.specificity });
}
