import {
  PHASE_2R_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  canPhase2RBridgeSerializeKey,
} from './policyBuilderPhase2LegacyBridgeIsolation.mjs';

const POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS = PHASE_2R_BRIDGE_ALLOWED_SERIALIZED_KEYS;

function canPolicyAuthoringBridgeSerializeKey(key) {
  return canPhase2RBridgeSerializeKey(key);
}

export {
  POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  canPolicyAuthoringBridgeSerializeKey,
};
