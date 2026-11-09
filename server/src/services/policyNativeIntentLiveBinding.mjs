/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';

/** Shared binding only; a matching value is not a minted scoring receipt. */
export function nativeIntentLiveBinding(policy, item) {
  try {
    const authority = policy?.policy_runtime_authority, contract = policy?.policy_intent_contract;
    const identity = inventoryRankingItemIdentity(item);
    if (!identity || authority?.sourceId !== 'native_intent' || authority.statusId !== 'native_intent_active' ||
        authority.validationOk !== true || contract?.source !== 'native_intent' || contract.validation?.valid !== true ||
        !Number.isInteger(policy.id) || positiveDatabaseInteger(policy.id) !== policy.id ||
        !Number.isInteger(policy.library_id) || positiveDatabaseInteger(policy.library_id) !== policy.library_id ||
        contract.policy_id !== policy.id || contract.library_id !== policy.library_id || !Array.isArray(contract.purpose)) return null;
    return createHash('sha256').update(JSON.stringify([identity, policy.id, policy.library_id, authority, contract])).digest('hex');
  } catch { return null; }
}
