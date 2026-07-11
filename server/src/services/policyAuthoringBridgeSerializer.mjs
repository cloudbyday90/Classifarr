import {
  POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  canPolicyAuthoringLegacyBridgeSerializeKey,
} from './policyAuthoringLegacyBridgeBoundary.mjs';

const POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS = POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS;

function canPolicyAuthoringBridgeSerializeKey(key) {
  return canPolicyAuthoringLegacyBridgeSerializeKey(key);
}

export {
  POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  canPolicyAuthoringBridgeSerializeKey,
};
