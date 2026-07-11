/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_AUTOMATION_READINESS_INPUT_VERSION = 'policy.automation_readiness_input.v1';
const MAX_ROUTING_TARGET_NAME_LENGTH = 160;

const POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_readiness_input_version',
  INVALID_ROUTING_STATE: 'invalid_readiness_routing_state',
  INVALID_PROFILE_FRESHNESS: 'invalid_profile_freshness_state',
  INVALID_HARD_LIMIT_STATE: 'invalid_hard_limit_conflict_state',
  RAW_CONFIGURATION_FIELD: 'raw_readiness_configuration_field',
});

const PROHIBITED_ROUTING_INPUT_KEYS = Object.freeze([
  'apiKey',
  'api_key',
  'baseUrl',
  'base_url',
  'url',
  'host',
  'password',
  'token',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = MAX_ROUTING_TARGET_NAME_LENGTH) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeOptionalBoolean(value, source, key) {
  if (!Object.hasOwn(source, key)) return null;
  return typeof value === 'boolean' ? value : 'invalid';
}

function normalizePolicyAutomationReadinessInputs({
  routing = {},
  profileFreshness = {},
  hardLimitConflict,
} = {}) {
  const routingSource = asObject(routing);
  const freshnessSource = asObject(profileFreshness);
  const configured = normalizeOptionalBoolean(routingSource.configured, routingSource, 'configured');
  const routeReady = normalizeOptionalBoolean(routingSource.routeReady, routingSource, 'routeReady');
  const stale = normalizeOptionalBoolean(freshnessSource.stale, freshnessSource, 'stale');
  const hardLimitConflictState = hardLimitConflict === undefined
    ? null
    : typeof hardLimitConflict === 'boolean'
      ? hardLimitConflict
      : 'invalid';
  const invalidRoutingState = configured === 'invalid' || routeReady === 'invalid';
  const invalidProfileFreshness = stale === 'invalid';
  const invalidHardLimitConflict = hardLimitConflictState === 'invalid';

  return {
    version: POLICY_AUTOMATION_READINESS_INPUT_VERSION,
    routing: {
      configured: configured === 'invalid' ? null : configured,
      routeReady: routeReady === 'invalid' ? null : routeReady,
      targetName: normalizeString(routingSource.targetName) || null,
      invalidState: invalidRoutingState,
    },
    profileFreshness: {
      stale: stale === true || invalidProfileFreshness,
      invalidState: invalidProfileFreshness,
    },
    hardLimitConflict: hardLimitConflictState === true || invalidHardLimitConflict,
    invalidHardLimitConflict,
  };
}

function buildPolicyAutomationReadinessInputSummary(input = {}) {
  const normalized = asObject(input);
  const routing = asObject(normalized.routing);
  const freshness = asObject(normalized.profileFreshness);

  return {
    version: normalized.version || null,
    routingConfigured: routing.configured,
    routeReady: routing.routeReady,
    hasRoutingTarget: Boolean(routing.targetName),
    routingStateInvalid: routing.invalidState === true,
    profileStale: freshness.stale === true,
    profileFreshnessInvalid: freshness.invalidState === true,
    hardLimitConflict: normalized.hardLimitConflict === true,
    hardLimitConflictInvalid: normalized.invalidHardLimitConflict === true,
  };
}

function buildPolicyAutomationReadinessInputAudit(input = {}, { rawRouting = {} } = {}) {
  const normalized = asObject(input);
  const routing = asObject(normalized.routing);
  const freshness = asObject(normalized.profileFreshness);
  const sourceRouting = asObject(rawRouting);
  const issues = [];

  if (normalized.version !== POLICY_AUTOMATION_READINESS_INPUT_VERSION) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Readiness inputs must use the current normalized input contract.',
    });
  }

  if (routing.invalidState === true) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.INVALID_ROUTING_STATE,
      message: 'Readiness routing state must use explicit boolean values.',
    });
  }

  if (freshness.invalidState === true) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.INVALID_PROFILE_FRESHNESS,
      message: 'Readiness profile freshness must use an explicit boolean value.',
    });
  }

  if (normalized.invalidHardLimitConflict === true) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.INVALID_HARD_LIMIT_STATE,
      message: 'Readiness hard-limit conflict must use an explicit boolean value.',
    });
  }

  if (PROHIBITED_ROUTING_INPUT_KEYS.some(key => Object.hasOwn(sourceRouting, key))) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.RAW_CONFIGURATION_FIELD,
      message: 'Readiness inputs must not retain raw routing configuration fields.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS,
  POLICY_AUTOMATION_READINESS_INPUT_VERSION,
  buildPolicyAutomationReadinessInputAudit,
  buildPolicyAutomationReadinessInputSummary,
  normalizePolicyAutomationReadinessInputs,
};
