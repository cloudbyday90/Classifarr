/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
} from './policyIntentSchema.mjs';

const POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS = Object.freeze({
  AUTHORITATIVE_NATIVE_INTENT: 'authoritative_native_intent',
  NO_ACTIVE_NATIVE_INTENT: 'no_active_native_intent',
  AMBIGUOUS_ACTIVE_NATIVE_INTENTS: 'ambiguous_active_native_intents',
  EMPTY_ACTIVE_INTENT: 'empty_active_intent',
  ACTIVE_INTENT_NOT_NATIVE: 'active_intent_not_native',
  ACTIVE_INTENT_INFERENCE_INCOMPLETE: 'active_intent_inference_incomplete',
  ACTIVE_INTENT_VALIDATION_UNSAFE: 'active_intent_validation_unsafe',
  ACTIVE_INTENT_MISSING_PURPOSE: 'active_intent_missing_purpose',
});

const POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS = Object.freeze({
  MATERIALIZABLE: 'materializable_native_intent',
  EMPTY_CONTRACT: 'empty_intent_contract',
  INFERENCE_INCOMPLETE: 'intent_contract_inference_incomplete',
  VALIDATION_UNSAFE: 'intent_contract_validation_unsafe',
  MISSING_PURPOSE: 'intent_contract_missing_purpose',
});

const SAFE_VALIDATION_STATUS_IDS = new Set(['valid', 'warning']);
const SQL_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getPurposeRuleCount(value = {}) {
  const intent = asObject(value);
  const rawValue = intent.purposeRuleCount ?? intent.purpose_rule_count;
  const numericValue = Number(rawValue);

  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : null;
}

function getIntentSource(value = {}) {
  const intent = asObject(value);
  return normalizeString(intent.source);
}

function getInferenceState(value = {}) {
  const intent = asObject(value);
  return normalizeString(intent.inferenceState ?? intent.inference_state);
}

function getValidationStatus(value = {}) {
  const intent = asObject(value);
  return normalizeString(intent.validationStatus ?? intent.validation_status);
}

function buildEligibility({
  stateId,
  activeIntentCount,
  authoritative,
  purposeRuleCount = null,
} = {}) {
  return {
    stateId,
    activeIntentCount,
    authoritative,
    ...(purposeRuleCount === null ? {} : { purposeRuleCount }),
  };
}

function buildNativeIntentAuthorityEligibility({ activeIntents = [] } = {}) {
  const boundedActiveIntents = asArray(activeIntents).slice(0, 2);
  const activeIntentCount = boundedActiveIntents.length;

  if (activeIntentCount === 0) {
    return buildEligibility({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.NO_ACTIVE_NATIVE_INTENT,
      activeIntentCount: 0,
      authoritative: false,
    });
  }

  if (activeIntentCount > 1) {
    return buildEligibility({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
      activeIntentCount: 2,
      authoritative: false,
    });
  }

  const intent = boundedActiveIntents[0];
  const source = getIntentSource(intent);
  const inferenceState = getInferenceState(intent);
  const validationStatus = getValidationStatus(intent);
  const purposeRuleCount = getPurposeRuleCount(intent);

  if (
    source === POLICY_INTENT_SOURCES.EMPTY &&
    inferenceState === POLICY_INTENT_INFERENCE_STATES.EMPTY &&
    purposeRuleCount === 0
  ) {
    return buildEligibility({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.EMPTY_ACTIVE_INTENT,
      activeIntentCount: 1,
      authoritative: false,
      purposeRuleCount,
    });
  }

  if (source !== POLICY_INTENT_SOURCES.NATIVE_INTENT) {
    return buildEligibility({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_NOT_NATIVE,
      activeIntentCount: 1,
      authoritative: false,
      purposeRuleCount,
    });
  }

  if (inferenceState !== POLICY_INTENT_INFERENCE_STATES.INFERRED) {
    return buildEligibility({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_INFERENCE_INCOMPLETE,
      activeIntentCount: 1,
      authoritative: false,
      purposeRuleCount,
    });
  }

  if (!SAFE_VALIDATION_STATUS_IDS.has(validationStatus)) {
    return buildEligibility({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_VALIDATION_UNSAFE,
      activeIntentCount: 1,
      authoritative: false,
      purposeRuleCount,
    });
  }

  if (purposeRuleCount === null || purposeRuleCount < 1) {
    return buildEligibility({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_MISSING_PURPOSE,
      activeIntentCount: 1,
      authoritative: false,
      purposeRuleCount,
    });
  }

  return buildEligibility({
    stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.AUTHORITATIVE_NATIVE_INTENT,
    activeIntentCount: 1,
    authoritative: true,
    purposeRuleCount,
  });
}

function buildNativeIntentMaterializationEligibility(contract = {}) {
  const normalizedContract = asObject(contract);
  const source = normalizeString(normalizedContract.source);
  const inferenceState = normalizeString(normalizedContract.inference_state);
  const valid = normalizedContract.validation?.valid === true;
  const purposeRuleCount = asArray(normalizedContract.purpose).length;

  if (source === POLICY_INTENT_SOURCES.EMPTY || !source) {
    return {
      stateId: POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS.EMPTY_CONTRACT,
      materializable: false,
      purposeRuleCount,
    };
  }

  if (inferenceState !== POLICY_INTENT_INFERENCE_STATES.INFERRED) {
    return {
      stateId: POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS.INFERENCE_INCOMPLETE,
      materializable: false,
      purposeRuleCount,
    };
  }

  if (!valid) {
    return {
      stateId: POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS.VALIDATION_UNSAFE,
      materializable: false,
      purposeRuleCount,
    };
  }

  if (purposeRuleCount < 1) {
    return {
      stateId: POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS.MISSING_PURPOSE,
      materializable: false,
      purposeRuleCount,
    };
  }

  return {
    stateId: POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS.MATERIALIZABLE,
    materializable: true,
    purposeRuleCount,
  };
}

function buildNativeIntentAuthoritySqlPredicate({ intentAlias = 'policy_intent' } = {}) {
  if (!SQL_IDENTIFIER_PATTERN.test(intentAlias)) {
    throw new TypeError('intentAlias must be a simple SQL identifier');
  }

  return `${intentAlias}.active = TRUE
        AND ${intentAlias}.source = '${POLICY_INTENT_SOURCES.NATIVE_INTENT}'
        AND ${intentAlias}.inference_state = '${POLICY_INTENT_INFERENCE_STATES.INFERRED}'
        AND ${intentAlias}.validation_status IN ('valid', 'warning')
        AND EXISTS (
          SELECT 1
          FROM policy_intent_rules authority_purpose_rule
          WHERE authority_purpose_rule.intent_id = ${intentAlias}.id
            AND authority_purpose_rule.intent_role = 'purpose'
        )`;
}

export {
  POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS,
  POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS,
  buildNativeIntentAuthorityEligibility,
  buildNativeIntentAuthoritySqlPredicate,
  buildNativeIntentMaterializationEligibility,
};
