/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import {
  validatePolicyInitialDeclaredIntent,
} from './policyInitialIntentEstablishmentContract.mjs';

const POLICY_AUTHORING_PROPOSAL_VERSION = 'policy.authoring_proposal.v1';
const MAX_POLICY_AUTHORING_PROPOSAL_REFERENCE_LENGTH = 96;
const MAX_POLICY_AUTHORING_DISPLAY_VALUES_PER_RULE = 5;

const POLICY_AUTHORING_LIFECYCLE_STATUS_IDS = Object.freeze({
  ELIGIBLE_TO_PREPARE_PROPOSAL: 'eligible_to_prepare_proposal',
  EXISTING_NATIVE_POLICY: 'existing_native_policy',
  EXISTING_COMPATIBILITY_POLICY: 'existing_compatibility_policy',
  PROFILE_RECOVERY_REQUIRED: 'profile_recovery_required',
  PROPOSAL_UNAVAILABLE: 'proposal_unavailable',
  LIBRARY_NOT_FOUND: 'library_not_found',
});

const POLICY_AUTHORING_PROPOSAL_STATUS_IDS = Object.freeze({
  PREPARED: 'proposal_prepared',
  CREATED: 'proposal_admission_created',
  REPLAYED: 'proposal_admission_replayed',
  PROPOSAL_UNAVAILABLE: 'proposal_unavailable',
  PROPOSAL_EXPIRED: 'proposal_expired',
  PROPOSAL_STALE: 'proposal_stale',
  EXISTING_POLICY: 'existing_policy',
  REQUEST_IN_PROGRESS: 'request_in_progress',
  IDEMPOTENCY_KEY_REUSED: 'idempotency_key_reused',
});

const POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS = Object.freeze({
  INVALID_REQUEST: 'policy_authoring_proposal_admission_invalid_request',
});

const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{32,96}$/u;
const REVISION_PATTERN = /^[a-f0-9]{64}$/u;

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value, maximumLength = 255) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximumLength);

  return normalized || null;
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
}

function readProfileFingerprint(value) {
  const normalized = normalizeString(value, 72);
  const fingerprint = normalized?.startsWith('sha256:')
    ? normalized.slice('sha256:'.length)
    : normalized;

  return REVISION_PATTERN.test(fingerprint || '') ? fingerprint : null;
}

function normalizeStoredJson(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function toDeclaredRule(rule = {}) {
  const source = asPlainObject(rule);
  const result = {
    signal_type: normalizeString(source.signal_type, 50),
    operator: normalizeString(source.operator, 50),
    values: asPlainObject(source.values),
  };

  const constraintMode = normalizeString(source.constraint_mode, 30);
  const semantics = normalizeString(source.semantics, 30);
  if (constraintMode) result.constraint_mode = constraintMode;
  if (semantics) result.semantics = semantics;

  return result;
}

function buildDeclaredIntentFromProfileContract(profileInitialIntent = {}) {
  const contract = asPlainObject(profileInitialIntent.contract);
  const declaredIntent = {
    purpose: asArray(contract.purpose).map(toDeclaredRule),
    hard_limits: asArray(contract.hard_limits).map(toDeclaredRule),
    helpful_hints: asArray(contract.helpful_hints).map(toDeclaredRule),
    avoid: asArray(contract.avoid).map(toDeclaredRule),
  };
  const validation = validatePolicyInitialDeclaredIntent(declaredIntent);

  return {
    ok: profileInitialIntent.ready === true && contract.validation?.valid === true && validation.ok,
    declaredIntent: validation.declaredIntent,
  };
}

function ruleDisplayValues(rule = {}) {
  const values = asPlainObject(rule.values);
  const preferredValue = values[rule.operator];
  const candidates = Array.isArray(preferredValue)
    ? preferredValue
    : Object.values(values).find(Array.isArray) || [];

  return candidates
    .map(value => normalizeString(value, 120))
    .filter(Boolean)
    .slice(0, MAX_POLICY_AUTHORING_DISPLAY_VALUES_PER_RULE);
}

function buildDisplayRule(rule = {}) {
  return {
    signalType: rule.signal_type,
    operator: rule.operator,
    values: ruleDisplayValues(rule),
  };
}

function buildPolicyName(library = {}) {
  const libraryName = normalizeString(library.name, 246) || 'Library';
  return `${libraryName} Policy`;
}

function buildProposalRevision({ libraryId, profileFingerprint, declaredIntent }) {
  return createHash('sha256')
    .update(stableJson({
      version: POLICY_AUTHORING_PROPOSAL_VERSION,
      libraryId,
      profileFingerprint,
      declaredIntent,
    }), 'utf8')
    .digest('hex');
}

function buildPolicyAuthoringProposalCandidate({ library = {}, profileInitialIntent = {} } = {}) {
  const libraryId = normalizePositiveInteger(library.id ?? library.library_id);
  const profileFingerprint = readProfileFingerprint(profileInitialIntent?.profile?.profileFingerprint);
  const declaration = buildDeclaredIntentFromProfileContract(profileInitialIntent);

  if (!libraryId || !profileFingerprint || !declaration.ok || !declaration.declaredIntent) {
    return null;
  }

  const declaredIntent = declaration.declaredIntent;
  const proposalRevision = buildProposalRevision({
    libraryId,
    profileFingerprint,
    declaredIntent,
  });

  return {
    libraryId,
    policyName: buildPolicyName(library),
    profileFingerprint,
    proposalRevision,
    declaredIntent,
    displaySummary: {
      title: buildPolicyName(library),
      purpose: declaredIntent.purpose.map(buildDisplayRule),
      helpfulHints: declaredIntent.helpful_hints.map(buildDisplayRule),
      hardLimitCount: declaredIntent.hard_limits.length,
      avoidCount: declaredIntent.avoid.length,
    },
  };
}

function validatePolicyAuthoringProposalPrepareRequest(payload) {
  const source = payload === undefined ? {} : payload;
  const valid = source && typeof source === 'object' && !Array.isArray(source) &&
    Object.keys(source).length === 0;

  return {
    ok: valid,
    errorId: valid ? null : POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS.INVALID_REQUEST,
  };
}

function validatePolicyAuthoringProposalAdmissionRequest(payload) {
  const source = asPlainObject(payload);
  const unknownKeys = Object.keys(source).filter(key => ![
    'proposal_revision',
    'adjustment_commands',
  ].includes(key));
  const proposalRevision = normalizeString(source.proposal_revision, 64);
  const adjustmentCommands = source.adjustment_commands;
  const valid = unknownKeys.length === 0 &&
    REVISION_PATTERN.test(proposalRevision || '') &&
    Array.isArray(adjustmentCommands) &&
    adjustmentCommands.length === 0;

  return {
    ok: valid,
    value: valid
      ? { proposalRevision, adjustmentCommands: [] }
      : null,
    errorId: valid ? null : POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS.INVALID_REQUEST,
  };
}

function normalizePolicyAuthoringProposalReference(value) {
  const reference = normalizeString(value, MAX_POLICY_AUTHORING_PROPOSAL_REFERENCE_LENGTH);
  return REFERENCE_PATTERN.test(reference || '') ? reference : null;
}

function parseStoredPolicyAuthoringProposal(row = {}) {
  const source = asPlainObject(row);
  const reference = normalizePolicyAuthoringProposalReference(source.proposal_reference);
  const revision = normalizeString(source.proposal_revision, 64);
  const profileFingerprint = normalizeString(source.profile_fingerprint, 64);
  const libraryId = normalizePositiveInteger(source.library_id);
  const actorId = normalizePositiveInteger(source.actor_id);
  const expiresAtValue = typeof source.expires_at === 'string'
    ? Date.parse(source.expires_at)
    : Number.NaN;
  const expiresAt = Number.isFinite(expiresAtValue)
    ? new Date(expiresAtValue).toISOString()
    : null;

  if (!reference || !REVISION_PATTERN.test(revision || '') ||
      !REVISION_PATTERN.test(profileFingerprint || '') || !libraryId || !actorId || !expiresAt) {
    return null;
  }

  return {
    id: normalizePositiveInteger(source.id),
    reference,
    proposalRevision: revision,
    profileFingerprint,
    libraryId,
    actorId,
    policyName: normalizeString(source.policy_name, 255),
    declaredIntent: normalizeStoredJson(source.canonical_declared_intent),
    displaySummary: normalizeStoredJson(source.display_summary),
    state: source.state === 'consumed' ? 'consumed' : 'prepared',
    expiresAt,
    consumedPolicyId: normalizePositiveInteger(source.consumed_policy_id),
  };
}

function policyAuthoringProposalIsExpired(proposal = {}, now = new Date()) {
  const expiresAt = Date.parse(proposal.expiresAt);
  const currentTime = now instanceof Date ? now.getTime() : Date.parse(now);
  return Number.isFinite(expiresAt) && Number.isFinite(currentTime) && expiresAt <= currentTime;
}

export {
  MAX_POLICY_AUTHORING_PROPOSAL_REFERENCE_LENGTH,
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS,
  POLICY_AUTHORING_PROPOSAL_STATUS_IDS,
  POLICY_AUTHORING_PROPOSAL_VERSION,
  buildPolicyAuthoringProposalCandidate,
  buildProposalRevision,
  normalizePolicyAuthoringProposalReference,
  parseStoredPolicyAuthoringProposal,
  policyAuthoringProposalIsExpired,
  stableJson,
  validatePolicyAuthoringProposalAdmissionRequest,
  validatePolicyAuthoringProposalPrepareRequest,
};
