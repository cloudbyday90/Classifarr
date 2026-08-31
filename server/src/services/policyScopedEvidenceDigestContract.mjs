/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildNativeIntentAuthority } from './policyNativeIntentAuthority.mjs';

export const POLICY_SCOPED_EVIDENCE_DIGEST_VERSION = 1;
export const POLICY_SCOPED_EVIDENCE_HISTORY_WINDOW_DAYS = 90;

const ALLOWED_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios', 'media_type']);
const ALLOWED_PROFILE_CAPTURE_STATES = new Set([
  'captured',
  'profile_unavailable',
  'profile_rejected',
]);
const ALLOWED_PROFILE_FRESHNESS_STATES = new Set(['current', 'stale', 'unavailable']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeSignalTypes(value) {
  return [...new Set(asArray(value)
    .map(asNonEmptyString)
    .filter((signalType) => ALLOWED_SIGNAL_TYPES.has(signalType)))].sort();
}

function normalizeProfile(profile) {
  const captureState = asNonEmptyString(profile?.capture_state);
  const freshnessState = asNonEmptyString(profile?.profile_freshness_state);

  if (!ALLOWED_PROFILE_CAPTURE_STATES.has(captureState)) {
    return {
      statusId: 'not_observed',
      available: false,
      sourceId: null,
      captureReasonId: null,
      freshnessState: 'unavailable',
      capturedAt: null,
      expiresAt: null,
      payloadRedacted: true,
    };
  }

  return {
    statusId: captureState,
    available: captureState === 'captured',
    sourceId: asNonEmptyString(profile?.source_id) || null,
    captureReasonId: asNonEmptyString(profile?.capture_reason_id) || null,
    freshnessState: ALLOWED_PROFILE_FRESHNESS_STATES.has(freshnessState)
      ? freshnessState
      : 'unavailable',
    capturedAt: toIsoTimestamp(profile?.created_at),
    expiresAt: toIsoTimestamp(profile?.expires_at),
    payloadRedacted: profile?.payload_redacted === true,
  };
}

function buildDeclaredIntent(activeIntents = []) {
  const authority = buildNativeIntentAuthority({ activeIntents });
  const activeIntent = asArray(activeIntents)[0] || {};

  return {
    authority,
    purposeRuleCount: asNonNegativeInteger(activeIntent.purpose_rule_count),
    purposeSignalTypes: normalizeSignalTypes(activeIntent.purpose_signal_types),
  };
}

function buildAdmittedHistory(rows = [], { windowDays }) {
  const entries = asArray(rows)
    .map((row) => ({
      signalType: asNonEmptyString(row?.signal_type),
      admissionCount: asNonNegativeInteger(row?.admission_count),
      latestAdmissionAt: toIsoTimestamp(row?.latest_admission_at),
    }))
    .filter((entry) => ALLOWED_SIGNAL_TYPES.has(entry.signalType))
    .sort((left, right) => left.signalType.localeCompare(right.signalType));

  return {
    statusId: entries.length > 0 ? 'available' : 'no_policy_authorized_history',
    windowDays,
    admissionCount: entries.reduce((total, entry) => total + entry.admissionCount, 0),
    signalTypes: entries,
  };
}

function buildUncertainty({ declaredIntent, observedProfile, admittedHistory }) {
  const reasonIds = [];

  if (declaredIntent.authority.authoritative !== true) {
    reasonIds.push('declared_intent_not_authoritative');
  }
  if (observedProfile.statusId !== 'captured') {
    reasonIds.push('observed_profile_not_captured');
  } else if (observedProfile.freshnessState !== 'current') {
    reasonIds.push('observed_profile_not_current');
  }
  if (admittedHistory.statusId !== 'available') {
    reasonIds.push('no_policy_authorized_history_in_window');
  }

  return reasonIds;
}

function buildPolicy(policy = {}) {
  const policyId = asPositiveInteger(policy.id);
  const libraryId = asPositiveInteger(policy.library_id);
  if (!policyId || !libraryId) return null;

  return {
    id: policyId,
    name: asNonEmptyString(policy.name) || 'Unnamed policy',
    library: {
      id: libraryId,
      name: asNonEmptyString(policy.library_name) || 'Unnamed library',
      mediaType: asNonEmptyString(policy.library_media_type),
    },
  };
}

export function buildPolicyScopedEvidenceDigest({
  policy,
  activeIntents = [],
  observedProfile = null,
  admittedHistory = [],
  evaluatedAt = new Date(),
  historyWindowDays = POLICY_SCOPED_EVIDENCE_HISTORY_WINDOW_DAYS,
} = {}) {
  const normalizedPolicy = buildPolicy(policy);
  if (!normalizedPolicy) return null;

  const normalizedWindowDays = asPositiveInteger(historyWindowDays) ||
    POLICY_SCOPED_EVIDENCE_HISTORY_WINDOW_DAYS;
  const declaredIntent = buildDeclaredIntent(activeIntents);
  const normalizedObservedProfile = normalizeProfile(observedProfile);
  const normalizedAdmittedHistory = buildAdmittedHistory(admittedHistory, {
    windowDays: normalizedWindowDays,
  });

  return {
    version: `policy_scoped_evidence_digest.v${POLICY_SCOPED_EVIDENCE_DIGEST_VERSION}`,
    statusId: 'available',
    policy: normalizedPolicy,
    evaluatedAt: toIsoTimestamp(evaluatedAt) || new Date().toISOString(),
    declaredIntent,
    observedLibraryProfile: normalizedObservedProfile,
    admittedHistory: normalizedAdmittedHistory,
    uncertaintyReasonIds: buildUncertainty({
      declaredIntent,
      observedProfile: normalizedObservedProfile,
      admittedHistory: normalizedAdmittedHistory,
    }),
    scope: {
      policyScoped: true,
      historyWindowDays: normalizedWindowDays,
      rawMediaExposed: false,
      rawRuleValuesExposed: false,
      rawProfilePayloadExposed: false,
      aiInvoked: false,
      routingAffected: false,
      learningAffected: false,
    },
  };
}

export function buildPolicyScopedEvidenceDigestUnavailable({ policyId = null } = {}) {
  return {
    version: `policy_scoped_evidence_digest.v${POLICY_SCOPED_EVIDENCE_DIGEST_VERSION}`,
    statusId: 'unavailable',
    policyId: asPositiveInteger(policyId),
    scope: {
      policyScoped: true,
      rawMediaExposed: false,
      rawRuleValuesExposed: false,
      rawProfilePayloadExposed: false,
      aiInvoked: false,
      routingAffected: false,
      learningAffected: false,
    },
  };
}
