/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';
import { nativeIntentLiveBinding } from './policyNativeIntentLiveBinding.mjs';
import { projectLivePolicyPurposeEvidence } from './policyPurposeMatchEvidence.mjs';
import { readNativeIntentContribution } from './policyNativeIntentContribution.mjs';
import { CANDIDATE_PURPOSE_LIMITS, candidatePurposeBytes, freezeCandidatePurpose,
  snapshotCandidatePurpose, unavailableCandidatePurpose } from './policyCandidatePurposeContract.mjs';

const retained = new WeakMap(), held = new WeakMap();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pair = row => `${row.policy_id}:${row.library_id}`;
const ranking = result => digest(result.ranked.map(row => [row.policy_id, row.library_id, row.score,
  row.auto_classify_threshold, row.prompt_threshold]));
const itemBinding = item => digest(['media_type', 'tmdb_id', 'genres', 'keywords', 'studios', 'production_companies', 'title', 'overview']
  .map(key => item[key]));
const shortlistBinding = contract => digest(contract.candidates.map(row =>
  [row.policyId, row.libraryId, row.libraryNumber, row.mediaType, row.policyScore]));

function policyBinding(policy, item) {
  const native = nativeIntentLiveBinding(policy, item), revision = policy.native_intent_version;
  if (!native || !Number.isSafeInteger(revision) || revision < 1 || policy.library_media_type !== item.media_type) return null;
  return digest([native, revision, policy.library_media_type, ...['enabled', 'priority', 'sort_order', 'preset_weight', 'profile_weight', 'pattern_weight',
    'rag_weight', 'history_weight', 'trust_patterns', 'trust_rag', 'trust_history', 'combination_mode',
    'auto_classify_threshold', 'prompt_threshold'].map(key => policy[key])]);
}

function samePolicy(entry, item) {
  return entry.binding !== null && entry.binding === policyBinding(entry.policy, item);
}

/** Live production wrapper only. Private maps never add terms to result/History JSON. */
export function createLivePolicyCandidatePurposeCapture(item) {
  let identity = null, itemProof = null, entries = [], started = false;
  return {
    start(_loaded, compatible) {
      try {
        identity = inventoryRankingItemIdentity(item); itemProof = itemBinding(item);
        if (!identity || compatible.length > CANDIDATE_PURPOSE_LIMITS.candidates) return;
        entries = compatible.map(policy => {
          const binding = policyBinding(policy, item);
          const sourceWeight = policy.preset_weight ?? 0.35;
          return { policy, binding, recorded: false, proof: null, payload: !binding
            ? unavailableCandidatePurpose('missing_native_binding')
            : !(typeof sourceWeight === 'number' && Number.isFinite(sourceWeight) && sourceWeight > 0)
              ? unavailableCandidatePurpose('source_disabled') : snapshotCandidatePurpose(policy) };
        });
        started = true;
      } catch { started = false; }
    },
    record(evaluation) {
      if (!started) return;
      try {
        const entry = entries.find(value => !value.recorded && value.policy.id === evaluation.policy_id && value.policy.library_id === evaluation.library_id);
        if (!entry) return;
        entry.recorded = true;
        if (entry.payload.statusId !== 'available') return;
        const runtime = evaluation.native_intent_runtime;
        const proof = projectLivePolicyPurposeEvidence(runtime?.purposeEvidence, entry.policy, item);
        if (itemBinding(item) !== itemProof || !samePolicy(entry, item) || !proof ||
            proof.runtimeEligible !== true || !(readNativeIntentContribution(runtime, entry.policy, item).score > 0)) {
          entry.payload = unavailableCandidatePurpose('evaluation_proof_unavailable'); return;
        }
        entry.proof = proof;
        const payload = { ...entry.payload, declaredMatch: proof.declaredMatch };
        entry.payload = candidatePurposeBytes(payload) <= CANDIDATE_PURPOSE_LIMITS.candidateBytes
          ? freezeCandidatePurpose(payload) : unavailableCandidatePurpose('payload_overflow', proof.origin);
      } catch { /* Diagnostic-only collector; no change to evaluation or admission. */ }
    },
    finish(result) {
      try {
        if (!started || inventoryRankingItemIdentity(item) !== identity || itemBinding(item) !== itemProof ||
            !Array.isArray(result.ranked) || result.ranked.length > CANDIDATE_PURPOSE_LIMITS.candidates) return result;
        const candidates = new Map();
        for (const row of result.ranked) {
          const entry = entries.find(value => value.policy.id === row.policy_id && value.policy.library_id === row.library_id);
          if (!entry || candidates.has(pair(row))) return result;
          let payload = entry.payload;
          if (payload.statusId === 'available') {
            const final = projectLivePolicyPurposeEvidence(row.candidate_diagnostics?.purpose_evidence, entry.policy, item);
            if (!entry.recorded || !samePolicy(entry, item) || !final || !entry.proof ||
                final.origin !== entry.proof.origin || final.declaredMatch !== entry.proof.declaredMatch || final.runtimeEligible !== true) {
              payload = unavailableCandidatePurpose('retained_proof_unavailable');
            }
          }
          candidates.set(pair(row), { ...entry, payload });
        }
        retained.set(result, { identity, itemProof, fingerprint: ranking(result), candidates });
      } catch { /* Never alter a valid classification or capture. */ }
      return result;
    },
  };
}

/** Empty opaque handle; copied objects, public diagnostics and replay carry no receipt. */
export function holdLivePolicyCandidatePurpose({ policyResult, contract, metadata }) {
  try {
    const receipt = retained.get(policyResult);
    if (!receipt || !contract?.valid || contract.version !== 'policy.candidate_adjudication.v1' ||
        contract.candidates.length < 2 || contract.candidates.length > 3 ||
        receipt.identity !== inventoryRankingItemIdentity(metadata) || receipt.itemProof !== itemBinding(metadata) ||
        receipt.fingerprint !== ranking(policyResult) ||
        contract.candidates.some((row, index) => row.libraryNumber !== index + 1 || row.mediaType !== metadata.media_type ||
          !receipt.candidates.has(`${row.policyId}:${row.libraryId}`)) ||
        new Set(contract.candidates.map(row => row.libraryId)).size !== contract.candidates.length) return null;
    const token = Object.freeze({});
    held.set(token, { receipt, policyResult, contract, shortlist: shortlistBinding(contract) });
    return token;
  } catch { return null; }
}

/** Recheck after async evidence/provider admission reads; never query current configuration. */
export function readHeldPolicyCandidatePurpose(token, metadata, libraries) {
  try {
    const value = held.get(token);
    if (!value) return null;
    const { receipt, policyResult, contract } = value;
    if (receipt !== retained.get(policyResult) || receipt.identity !== inventoryRankingItemIdentity(metadata) ||
        receipt.itemProof !== itemBinding(metadata) || receipt.fingerprint !== ranking(policyResult) ||
        value.shortlist !== shortlistBinding(contract) || !Array.isArray(libraries) || libraries.length !== contract.candidates.length ||
        libraries.some((library, index) => library.id !== contract.candidates[index].libraryId || library.is_active === false ||
          library.media_type !== metadata.media_type)) return null;
    return contract.candidates.map(row => {
      const entry = receipt.candidates.get(`${row.policyId}:${row.libraryId}`);
      return { libraryNumber: row.libraryNumber, purpose: entry.payload.statusId === 'available' && !samePolicy(entry, metadata)
        ? unavailableCandidatePurpose('binding_changed') : entry.payload };
    });
  } catch { return null; }
}
