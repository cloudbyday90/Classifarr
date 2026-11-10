/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { types } from 'node:util';

export const POLICY_RECOVERY_REFERENCE_LIMITS = Object.freeze({ candidates: 64, libraries: 64, bytes: 16 * 1024 });

/** Fixed own data fields only; this boundary never coerces an untrusted object. */
export function recoveryField(value, key) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw new Error('policy_recovery_reference');
  const prototype = Object.getPrototypeOf(value);
  // PostgreSQL/test VM records can belong to another realm. Never invoke a tag/coercion hook.
  if (types.isProxy(prototype) || prototype !== null && !Array.isArray(value) && Object.getPrototypeOf(prototype) !== null) throw new Error('policy_recovery_reference');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) throw new Error('policy_recovery_reference');
  return descriptor.value;
}

export function recoveryRows(value, limit) {
  if (types.isProxy(value) || !Array.isArray(value)) throw new Error('policy_recovery_reference');
  const length = recoveryField(value, 'length');
  if (length > limit) throw new Error('policy_recovery_reference');
  return Array.from({ length }, (_unused, index) => recoveryField(value, String(index)));
}

function databaseId(value) {
  if (!Number.isInteger(value) || value <= 0 || value > 2147483647) throw new Error('policy_recovery_reference');
  return value;
}
function score(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new Error('policy_recovery_reference');
  return value;
}
const optionalScore = value => value == null ? null : score(value);

export function recoveryItemIdentity(item) {
  try {
    const type = recoveryField(item, 'media_type'), id = databaseId(recoveryField(item, 'tmdb_id'));
    return ['movie', 'tv'].includes(type) ? `${type}:${id}` : null;
  } catch { return null; }
}

export function recoveryPolicyHeader(policy, mediaType) {
  const id = databaseId(recoveryField(policy, 'id')), library = databaseId(recoveryField(policy, 'library_id'));
  if (recoveryField(policy, 'enabled') !== true || recoveryField(policy, 'library_media_type') !== mediaType) throw new Error('policy_recovery_reference');
  const authority = recoveryField(policy, 'policy_runtime_authority');
  const source = recoveryField(authority, 'sourceId'), status = recoveryField(authority, 'statusId');
  let revision = null;
  if (source === 'native_intent' && status === 'native_intent_active') {
    revision = databaseId(recoveryField(policy, 'native_intent_version'));
    const contract = recoveryField(policy, 'policy_intent_contract');
    if (recoveryField(authority, 'validationOk') !== true || recoveryField(contract, 'source') !== source ||
        recoveryField(contract, 'policy_id') !== id || recoveryField(contract, 'library_id') !== library ||
        recoveryField(recoveryField(contract, 'validation'), 'valid') !== true) throw new Error('policy_recovery_reference');
  } else if (source !== 'compatibility_bridge' || status !== 'compatibility_bridge_fallback') throw new Error('policy_recovery_reference');
  const header = [id, library, mediaType, source, status, revision];
  if (JSON.stringify(recoveryEvaluationOrigin(policy)) !== JSON.stringify([source, status, id, revision])) throw new Error('policy_recovery_reference');
  return header;
}

export function recoveryEvaluationOrigin(row) {
  const trace = recoveryField(row, 'policy_intent_read_trace');
  const source = recoveryField(trace, 'source'), status = recoveryField(trace, 'status');
  const revision = recoveryField(trace, 'intent_version');
  if (!(source === 'native_intent' && status === 'native_intent_active' && databaseId(revision) === revision) &&
      !(source === 'compatibility_bridge' && status === 'compatibility_bridge_fallback' && revision === null)) throw new Error('policy_recovery_reference');
  return [source, status, databaseId(recoveryField(trace, 'policy_id')), revision];
}

export function recoveryPair(row) {
  return [databaseId(recoveryField(row, 'policy_id')), databaseId(recoveryField(row, 'library_id'))];
}

/** Complete closed numeric references, deliberately excluding names and raw diagnostics. */
export function recoveryDecisionSnapshot(result) {
  const ranked = recoveryRows(recoveryField(result, 'ranked'), POLICY_RECOVERY_REFERENCE_LIMITS.candidates).map(row => [
    ...recoveryPair(row), score(recoveryField(row, 'score')),
    optionalScore(recoveryField(row, 'auto_classify_threshold')), optionalScore(recoveryField(row, 'prompt_threshold')),
    recoveryEvaluationOrigin(row),
  ]);
  if (!ranked.length || new Set(ranked.map(row => `${row[0]}:${row[1]}`)).size !== ranked.length) throw new Error('policy_recovery_reference');
  const top = recoveryField(result, 'topCandidate');
  const leading = [...recoveryPair(top), score(recoveryField(top, 'score'))];
  if (JSON.stringify(leading) !== JSON.stringify(ranked[0].slice(0, 3))) throw new Error('policy_recovery_reference');
  const destination = recoveryField(result, 'library');
  if (destination != null && JSON.stringify(recoveryPair(destination)) !== JSON.stringify(leading.slice(0, 2))) throw new Error('policy_recovery_reference');
  const action = recoveryField(result, 'action');
  if (!['auto_classify', 'prompt_confirm', 'prompt_select', 'manual'].includes(action)) throw new Error('policy_recovery_reference');
  const thresholds = recoveryField(result, 'thresholds');
  return { ranked, leading, action, confidence: score(recoveryField(result, 'confidence')),
    thresholds: ['auto_classify', 'prompt', 'prompt_select'].map(key => optionalScore(recoveryField(thresholds, key))) };
}

export function recoveryLibraryPool(libraries) {
  return recoveryRows(libraries, POLICY_RECOVERY_REFERENCE_LIMITS.libraries).map(library => [
    databaseId(recoveryField(library, 'id')), recoveryField(library, 'media_type'), recoveryField(library, 'is_active'),
  ]).map(([id, mediaType, active]) => {
    if (!['movie', 'tv'].includes(mediaType) || typeof active !== 'boolean') throw new Error('policy_recovery_reference');
    return [id, mediaType, active];
  }).sort((left, right) => left[0] - right[0]);
}

export function boundedRecoveryReference(value) {
  const encoded = JSON.stringify(value);
  return Buffer.byteLength(encoded, 'utf8') <= POLICY_RECOVERY_REFERENCE_LIMITS.bytes ? encoded : null;
}
