/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { recoveryField as field, recoveryItemIdentity } from './policyRecoverySuggestionContract.mjs';
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { CURRENT_POLICY_REVIEW_VERSION, readCurrentPolicyReviewFrame } from './currentPolicyReviewFrameContract.mjs';
import { CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';

const attempted = Symbol('currentPolicyReviewAttempt');
const candidates = new WeakMap(), published = new WeakMap(), saved = new WeakMap();
function tuple(result) {
  const library = field(result, 'library');
  const libraryId = library == null ? null : field(library, 'id');
  const confidence = field(result, 'confidence');
  const method = field(result, 'method');
  if ((libraryId !== null && (!Number.isSafeInteger(libraryId) || libraryId <= 0)) ||
      typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 100 ||
      !CLASSIFIER_CAPTURE_METHODS.includes(method)) throw new TypeError('Invalid current policy review result');
  return JSON.stringify([libraryId, confidence, method]);
}
function valid(receipt, result, metadata) {
  if (!receipt || receipt.invalid) return false;
  try {
    if (receipt.current() && field(result, 'policyResult') === receipt.policyResult &&
        tuple(result) === receipt.tuple && (!metadata || recoveryItemIdentity(metadata) === receipt.identity)) return true;
  } catch { /* Inspection failures are evidence gaps, not classification failures. */ }
  receipt.invalid = true; return false;
}

/** Successful verification stages supply their private live-evaluation check. */
export function associateCurrentPolicyReviewCandidate(result, { seed, current, policyResult, metadata }) {
  try {
    // Register the attempt before inspecting values so inspection failure remains an explicit gap.
    candidates.set(result, { invalid: true });
    candidates.set(result, { seed, current, policyResult, identity: recoveryItemIdentity(metadata), tuple: tuple(result), invalid: false });
  } catch { /* The registered attempt retains its evidence-gap status. */ }
  return result;
}

/** Call only after exact apply selection and fulfilled rollout; no publication on shadow/rejection. */
export function publishCurrentPolicyReviewFrame(source, target) {
  const receipt = candidates.get(source);
  if (!receipt) return target;
  Object.defineProperty(target, attempted, { value: true, enumerable: true });
  valid(receipt, source);
  valid(receipt, target);
  published.set(target, receipt);
  return target;
}

/** Explicitly transfer authority across the two owner-controlled result copies. Spread alone is a gap. */
export function transferCurrentPolicyReviewFrame(source, target) {
  const receipt = published.get(source);
  if (receipt && source?.[attempted] === true) {
    valid(receipt, source); valid(receipt, target); published.set(target, receipt);
  }
  return target;
}

export function holdCurrentPolicyReviewFrame(result, metadata) {
  if (result?.[attempted] !== true) return null;
  const receipt = published.get(result);
  valid(receipt, result, metadata);
  return { receipt, result, metadata, invalid: !receipt };
}

/** Recheck at entry, after state derivation and immediately before INSERT serialization. */
export function projectCurrentPolicyReviewFrame(held) {
  if (!held) return null;
  if (!valid(held.receipt, held.result, held.metadata)) held.invalid = true;
  const identity = recoveryItemIdentity(held.metadata);
  let method = null;
  try {
    const observed = field(held.result, 'method');
    if (CLASSIFIER_CAPTURE_METHODS.includes(observed)) method = observed;
  } catch { held.invalid = true; }
  const frame = { version: CURRENT_POLICY_REVIEW_VERSION, classification_id: '9223372036854775807', identity_key: identity,
    method, status: held.invalid || !held.receipt?.seed ? 'evidence_gap' : 'recorded', policy: held.invalid ? null : held.receipt?.seed?.policy ?? null };
  const [mediaType, tmdbId] = identity?.split(':') ?? [];
  const checked = readCurrentPolicyReviewFrame(frame, { id: frame.classification_id, tmdb_id: Number(tmdbId),
    media_type: mediaType, method });
  if (checked) return checked;
  held.invalid = true;
  return Object.freeze({ ...frame, status: 'evidence_gap', policy: null });
}

/** Successful transaction acknowledgement supplies both notification paths without rereading History. */
export function rememberSavedCurrentPolicyReview(result, metadata, classificationId) {
  const frame = metadata.classification_details?.current_policy_review;
  if (!frame) return metadata;
  const bound = { ...metadata, classification_details: { ...metadata.classification_details,
    current_policy_review: Object.freeze({ ...frame, classification_id: canonicalDatabaseBigintId(classificationId) }) } };
  saved.set(result, bound);
  return bound;
}
export const savedCurrentPolicyReviewMetadata = (result, fallback) => saved.get(result) ?? fallback;
