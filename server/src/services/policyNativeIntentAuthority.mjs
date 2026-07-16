import {
  POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS,
  buildNativeIntentAuthorityEligibility,
} from './policyNativeIntentAuthorityEligibility.mjs';

const POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS = Object.freeze({
  NO_ACTIVE_NATIVE_INTENT: 'no_active_native_intent',
  SINGLE_ACTIVE_NATIVE_INTENT: 'single_active_native_intent',
  SINGLE_NON_AUTHORITATIVE_ACTIVE_INTENT: 'single_non_authoritative_active_intent',
  AMBIGUOUS_ACTIVE_NATIVE_INTENTS: 'ambiguous_active_native_intents',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getAuthorityStateId(value = {}) {
  return value.stateId ?? value.state_id ?? null;
}

function getActiveIntentCount(value = {}) {
  const numericValue = Number(value.activeIntentCount ?? value.active_intent_count);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : null;
}

function getIntegrityStatusId(value = {}) {
  return value.integrityStatusId ?? value.integrity_status_id ?? null;
}

function buildNativeIntentAuthority({ activeIntents = [] } = {}) {
  const eligibility = buildNativeIntentAuthorityEligibility({ activeIntents });
  const boundedActiveIntentCount = Math.min(asArray(activeIntents).length, 2);

  if (boundedActiveIntentCount === 0) {
    return {
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.NO_ACTIVE_NATIVE_INTENT,
      activeIntentCount: 0,
      authoritative: false,
    };
  }

  if (eligibility.authoritative) {
    return {
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_ACTIVE_NATIVE_INTENT,
      activeIntentCount: 1,
      authoritative: true,
    };
  }

  if (boundedActiveIntentCount === 1) {
    return {
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_NON_AUTHORITATIVE_ACTIVE_INTENT,
      activeIntentCount: 1,
      authoritative: false,
      integrityStatusId: eligibility.stateId,
    };
  }

  return {
    stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
    activeIntentCount: 2,
    authoritative: false,
  };
}

function normalizeNativeIntentAuthority(value = {}) {
  const authority = asObject(value);
  const stateId = getAuthorityStateId(authority);
  const activeIntentCount = getActiveIntentCount(authority);

  if (
    stateId === POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS &&
    activeIntentCount !== null &&
    activeIntentCount >= 2
  ) {
    return {
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
      activeIntentCount: 2,
      authoritative: false,
    };
  }

  if (
    stateId === POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_ACTIVE_NATIVE_INTENT &&
    activeIntentCount === 1
  ) {
    return {
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_ACTIVE_NATIVE_INTENT,
      activeIntentCount: 1,
      authoritative: true,
    };
  }

  if (
    stateId === POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_NON_AUTHORITATIVE_ACTIVE_INTENT &&
    activeIntentCount === 1 &&
    Object.values(POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS)
      .includes(getIntegrityStatusId(authority))
  ) {
    return {
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_NON_AUTHORITATIVE_ACTIVE_INTENT,
      activeIntentCount: 1,
      authoritative: false,
      integrityStatusId: getIntegrityStatusId(authority),
    };
  }

  if (
    stateId === POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.NO_ACTIVE_NATIVE_INTENT &&
    activeIntentCount === 0
  ) {
    return {
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.NO_ACTIVE_NATIVE_INTENT,
      activeIntentCount: 0,
      authoritative: false,
    };
  }

  return null;
}

function isNativeIntentAuthorityAmbiguous(value = {}) {
  return normalizeNativeIntentAuthority(value)?.stateId ===
    POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS;
}

function isNativeIntentAuthorityNonAuthoritative(value = {}) {
  return normalizeNativeIntentAuthority(value)?.stateId ===
    POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_NON_AUTHORITATIVE_ACTIVE_INTENT;
}

export {
  POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS,
  buildNativeIntentAuthority,
  isNativeIntentAuthorityAmbiguous,
  isNativeIntentAuthorityNonAuthoritative,
  normalizeNativeIntentAuthority,
};
