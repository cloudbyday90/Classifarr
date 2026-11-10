/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readLivePolicyRecoveryReference } from './policyRecoverySuggestionLiveReference.mjs';
import {
  recoveryField, recoveryRows, recoveryLibraryPool, boundedRecoveryReference, POLICY_RECOVERY_REFERENCE_LIMITS,
} from './policyRecoverySuggestionContract.mjs';

const held = new WeakMap();

function projection(receipt, result, context, libraries, selected) {
  if (recoveryField(context, 'ranked') !== recoveryField(result, 'ranked') ||
      recoveryField(context, 'confidence') !== recoveryField(result, 'confidence') ||
      recoveryField(context, 'suggestedLibrary') !== selected) return null;
  const snapshot = JSON.parse(receipt.snapshot), leading = snapshot.decision.leading;
  const pool = recoveryLibraryPool(libraries);
  if (pool.filter(row => row[0] === leading[1]).length !== 1 ||
      recoveryRows(libraries, POLICY_RECOVERY_REFERENCE_LIMITS.libraries).filter(library => library === selected).length !== 1 ||
      recoveryField(selected, 'id') !== leading[1] || recoveryField(selected, 'media_type') !== receipt.item.media_type ||
      recoveryField(selected, 'is_active') !== true) return null;
  return boundedRecoveryReference({ ...snapshot, pool });
}

/** Hold before asynchronous provider/support work; no public context field is added. */
export function holdPolicyRecoverySuggestion({ policyResult, metadata, signalContext, libraries }) {
  try {
    const receipt = readLivePolicyRecoveryReference(policyResult, metadata);
    if (!receipt) return null;
    const selected = recoveryField(signalContext, 'suggestedLibrary');
    const snapshot = projection(receipt, policyResult, signalContext, libraries, selected);
    if (!snapshot) return null;
    const token = Object.freeze({});
    held.set(token, { receipt, policyResult, metadata, signalContext, selected, snapshot });
    return token;
  } catch { return null; }
}

/** Loaded-snapshot consistency only. This does not query current database configuration. */
export function readPolicyRecoverySuggestion(token, { policyResult, metadata, signalContext, libraries }) {
  try {
    const value = held.get(token);
    if (!value || value.policyResult !== policyResult || value.metadata !== metadata || value.signalContext !== signalContext ||
        value.receipt !== readLivePolicyRecoveryReference(policyResult, metadata) ||
        value.snapshot !== projection(value.receipt, policyResult, signalContext, libraries, value.selected)) return null;
    return value.selected;
  } catch { return null; }
}
