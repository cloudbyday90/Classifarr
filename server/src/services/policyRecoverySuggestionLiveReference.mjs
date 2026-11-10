/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {
  POLICY_RECOVERY_REFERENCE_LIMITS, recoveryRows, recoveryPolicyHeader, recoveryPair,
  recoveryDecisionSnapshot, recoveryEvaluationOrigin, boundedRecoveryReference, recoveryItemIdentity,
} from './policyRecoverySuggestionContract.mjs';

const retained = new WeakMap();
const encode = value => JSON.stringify(value);

/** Production evaluator only. Diagnostic captures are never suggestion authority. */
export function createLivePolicyRecoveryReference(item) {
  const identity = recoveryItemIdentity(item);
  const mediaType = identity?.split(':')[0];
  let entries = null;
  return {
    start(_loaded, compatible) {
      try {
        if (!identity || recoveryItemIdentity(item) !== identity) return;
        entries = recoveryRows(compatible, POLICY_RECOVERY_REFERENCE_LIMITS.candidates).map(policy => ({
          policy, header: recoveryPolicyHeader(policy, mediaType), recorded: false,
        }));
        if (new Set(entries.map(entry => encode(entry.header.slice(0, 2)))).size !== entries.length) entries = null;
      } catch { entries = null; }
    },
    record(policy, evaluation) {
      if (!entries) return;
      try {
        const entry = entries.find(value => value.policy === policy);
        if (!entry || entry.recorded || encode(recoveryPolicyHeader(policy, mediaType)) !== encode(entry.header) ||
            encode(recoveryPair(evaluation)) !== encode(entry.header.slice(0, 2)) ||
            encode(recoveryEvaluationOrigin(evaluation)) !== encode([entry.header[3], entry.header[4], entry.header[0], entry.header[5]])) {
          entries = null; return;
        }
        entry.recorded = true;
      } catch { entries = null; }
    },
    finish(result) {
      try {
        if (!entries || !entries.length || recoveryItemIdentity(item) !== identity || entries.some(entry => !entry.recorded ||
            encode(recoveryPolicyHeader(entry.policy, mediaType)) !== encode(entry.header))) return result;
        const decision = recoveryDecisionSnapshot(result);
        for (const row of decision.ranked) {
          const entry = entries.find(value => value.header[0] === row[0] && value.header[1] === row[1]);
          if (!entry || encode(row[5]) !== encode([entry.header[3], entry.header[4], entry.header[0], entry.header[5]])) return result;
        }
        const snapshot = boundedRecoveryReference({ identity, headers: entries.map(entry => entry.header), decision });
        if (snapshot) retained.set(result, Object.freeze({ item, identity, snapshot, decision: encode(decision) }));
      } catch { /* Missing proof must never change the evaluation itself. */ }
      finally { entries = null; }
      return result;
    },
  };
}

/** Exact live object and typed identity; equal fields, copies and replay are insufficient. */
export function readLivePolicyRecoveryReference(result, item) {
  try {
    const receipt = retained.get(result);
    return receipt && receipt.item === item && receipt.identity === recoveryItemIdentity(item) &&
      receipt.decision === encode(recoveryDecisionSnapshot(result)) ? receipt : null;
  } catch { return null; }
}
