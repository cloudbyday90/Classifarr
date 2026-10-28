/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';
import { buildPolicyPurposeProvenance } from './policyDeclaredPurposeProvenance.mjs';
import { isComparablePolicyCandidate } from './policyInferredPurposeAdmission.mjs';
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { POLICY_EVALUATION_CAPTURE_VERSION, POLICY_EVALUATION_CAPTURE_BYTES, POLICY_EVALUATION_CAPTURE_CANDIDATES, POLICY_EVALUATION_SOURCES,
  POLICY_EVALUATION_AUTHORITY_STATUSES, POLICY_EVALUATION_RUNTIME_STATUSES, validPolicyEvaluationCapture,
  policyEvaluationPayloadBytes,
  freezePolicyEvaluationValue as freeze } from './policyEvaluationCaptureContract.mjs';

const minted = new WeakMap(), heldReceipts = new WeakSet();
// Enumerable symbols survive object spread while JSON/retry/History serialization omits them.
const captureKey = Symbol('retainedPolicyEvaluationCapture');
export const getLivePolicyEvaluationCapture = result => result?.[captureKey] ?? null;
const known = (values, value) => values.includes(value) ? value : 'unverified';
const threshold = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const thresholds = row => ({ autoClassify: threshold(row.auto_classify_threshold), prompt: threshold(row.prompt_threshold) });
const numbers = row => Object.fromEntries(['preset', 'intent', 'pattern', 'rag', 'history', 'profile'].map(key => [key, row?.[key]]));
const ranking = result => (result?.ranked ?? []).map(row => ({ policyId: row.policy_id, libraryId: row.library_id,
  score: row.score, thresholds: thresholds(row) }));
const fingerprint = result => JSON.stringify(ranking(result));
const policyResult = result => result?.policyResult ?? result?.signalContext?.policyResult;

function policyHeader(policy) {
  const authority = policy.policy_runtime_authority, contract = policy.policy_intent_contract;
  const source = known(POLICY_EVALUATION_SOURCES, authority?.sourceId);
  return { policyId: policy.id, libraryId: policy.library_id,
    authority: { source, status: known(POLICY_EVALUATION_AUTHORITY_STATUSES, authority?.statusId), validationOk: authority?.validationOk === true },
    purposeProvenance: source === 'native_intent' && authority?.validationOk === true && contract?.validation?.valid === true &&
      contract.policy_id === policy.id && contract.library_id === policy.library_id
      ? buildPolicyPurposeProvenance(contract.purpose).id : 'unverified' };
}

function runtimeProjection(evaluation, source) {
  const runtime = evaluation.native_intent_runtime;
  if (!runtime) return { status: source === 'native_intent' ? 'unverified' : 'not_applicable', eligible: null,
    admission: source === 'native_intent' ? 'unverified' : 'not_applicable' };
  return { status: known(POLICY_EVALUATION_RUNTIME_STATUSES, runtime.statusId),
    eligible: typeof runtime.eligible === 'boolean' ? runtime.eligible : null,
    admission: runtime.admissionBasis === 'inferred_profile_ranking' ? 'inferred_profile_ranking' :
      runtime.admissionBasis == null ? 'not_recorded' : 'unverified' };
}

/** Per-call capability supplied only by the production wrapper. Generic/offline evaluators default off. */
export function createLivePolicyEvaluationCapture(item) {
  const identityKey = inventoryRankingItemIdentity(item), mediaType = item?.media_type;
  let headers = [], evaluations = [], policyCount = 0, skippedMediaTypeCount = 0, gap = null;
  return {
    start(policies, compatible, skipped) {
      try {
        policyCount = policies.length; skippedMediaTypeCount = skipped;
        if (compatible.length > POLICY_EVALUATION_CAPTURE_CANDIDATES) { gap = 'pool_overflow'; return; }
        headers = freeze(compatible.map(policyHeader));
      } catch { gap = 'capture_invalid'; }
    },
    record(evaluation) {
      if (gap) return;
      try {
        const header = headers[evaluations.length];
        evaluations.push(freeze({ policyId: evaluation.policy_id, libraryId: evaluation.library_id,
          rawScore: evaluation.score, scores: numbers(evaluation.scores), weights: numbers(evaluation.weights),
          thresholds: thresholds(evaluation), runtime: runtimeProjection(evaluation, header?.authority.source),
          comparable: isComparablePolicyCandidate(evaluation) }));
      } catch { gap = 'capture_invalid'; }
    },
    finish(result, conflicts = new Set(), reason = null) {
      try {
        const capturedAt = new Date().toISOString();
        if (!identityKey || inventoryRankingItemIdentity(item) !== identityKey) return result;
        let payload = null;
        gap = reason ?? gap;
        if (!gap) {
          const ranked = ranking(result), rankedIds = new Set(ranked.map(row => row.policyId));
          const candidates = headers.map((header, index) => {
            const evaluation = evaluations[index];
            if (header.policyId !== evaluation?.policyId || header.libraryId !== evaluation?.libraryId) throw new Error('capture_binding');
            const { comparable, ...numeric } = evaluation;
            return { ...header, ...numeric, disposition: conflicts.has(header.policyId) ? 'constraint_conflict' :
              !comparable ? 'non_comparable' : rankedIds.has(header.policyId) ? 'ranked' : 'ranking_excluded' };
          });
          payload = { version: POLICY_EVALUATION_CAPTURE_VERSION, mediaType, identityKey, capturedAt,
            stage: 'retained_policy_evaluation', policyCount, skippedMediaTypeCount, candidates, ranked,
            exclusions: Object.fromEntries(['constraint_conflict', 'non_comparable', 'ranking_excluded'].map(reasonId =>
              [reasonId, candidates.filter(row => row.disposition === reasonId).length])) };
          const payloadBytes = policyEvaluationPayloadBytes(payload);
          if (!Number.isFinite(payloadBytes)) gap = 'capture_invalid';
          else if (payloadBytes > POLICY_EVALUATION_CAPTURE_BYTES) gap = 'payload_overflow';
          else if (!validPolicyEvaluationCapture(payload)) gap = 'capture_invalid';
        }
        const capture = freeze({ mediaType, identityKey, capturedAt, reasonId: gap ?? 'complete', payload: gap ? null : payload });
        minted.set(capture, { ranking: fingerprint(result), classificationId: null });
        return { ...result, [captureKey]: capture };
      } catch { return result; /* Evidence failure cannot change classification. */ }
    },
  };
}

/** Hold exactly the retained live object before persistence awaits. Serialized copies have no receipt. */
export function holdPolicyEvaluationCapture(result, metadata) {
  const retained = policyResult(result), capture = getLivePolicyEvaluationCapture(retained);
  if (!capture || !minted.has(capture)) return null;
  const held = Object.freeze({ capture, retained, identityKey: inventoryRankingItemIdentity(metadata) });
  heldReceipts.add(held); return held;
}

export function projectHeldPolicyEvaluationCapture(held, result, metadata, classificationId) {
  if (!held || !heldReceipts.has(held)) return null;
  const key = inventoryRankingItemIdentity(metadata);
  if (!key) return null;
  const capture = held.capture, retained = policyResult(result), receipt = minted.get(capture);
  if (classificationId !== undefined) {
    const id = canonicalDatabaseBigintId(classificationId);
    if (!id || receipt.classificationId !== null && receipt.classificationId !== id) return null;
    receipt.classificationId = id;
  }
  const valid = held.identityKey === key && capture.identityKey === key && retained === held.retained &&
    getLivePolicyEvaluationCapture(retained) === capture && receipt.ranking === fingerprint(retained);
  return valid ? capture : freeze({ mediaType: metadata.media_type, identityKey: key, capturedAt: capture.capturedAt,
    reasonId: 'binding_failure', payload: null });
}
