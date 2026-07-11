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
  buildPolicyLibraryIntentProposalAudit,
  POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS,
} from './policyLibraryIntentProposalService.mjs';

const POLICY_INTENT_PROPOSAL_REGISTRY_VERSION = 'policy.intent_proposal_registry.v1';
const DEFAULT_PROPOSAL_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAXIMUM_ENTRIES = 100;
const DEFAULT_MAXIMUM_ENTRIES_PER_ACTOR = 10;
const MAXIMUM_PROPOSAL_TTL_MS = 60 * 60 * 1000;
const MAXIMUM_PROPOSAL_REFERENCE_LENGTH = 120;
const HEX_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

const POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS = Object.freeze({
  REGISTERED: 'registered',
  INVALID_PROPOSAL: 'invalid_proposal',
  INVALID_REFERENCE: 'invalid_reference',
  UNAUTHORIZED_ACTOR: 'unauthorized_actor',
  PROPOSAL_UNAVAILABLE: 'proposal_unavailable',
  PROPOSAL_EXPIRED: 'proposal_expired',
  PROPOSAL_FINGERPRINT_MISMATCH: 'proposal_fingerprint_mismatch',
  REGISTRY_CAPACITY_REACHED: 'registry_capacity_reached',
  ACTOR_CAPACITY_REACHED: 'actor_capacity_reached',
  CONSUMED: 'consumed',
  REGISTRY_FAILED: 'registry_failed',
});

const POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS = Object.freeze({
  INVALID_PROPOSAL: 'invalid_proposal',
  INVALID_REFERENCE: 'invalid_reference',
  UNAUTHORIZED_ACTOR: 'unauthorized_actor',
  PROPOSAL_UNAVAILABLE: 'proposal_unavailable',
  PROPOSAL_EXPIRED: 'proposal_expired',
  PROPOSAL_FINGERPRINT_MISMATCH: 'proposal_fingerprint_mismatch',
  REGISTRY_CAPACITY_REACHED: 'registry_capacity_reached',
  ACTOR_CAPACITY_REACHED: 'actor_capacity_reached',
  REGISTRY_FAILED: 'proposal_registry_failed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  INVALID_RESULT: 'invalid_registry_result',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePositiveInteger(value, fallback, maximum) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) return fallback;
  return Math.min(normalized, maximum);
}

function normalizeRegistryActor(actor = {}, { requireAuthenticated = true } = {}) {
  const source = asPlainObject(actor);
  const id = Number(source.id);

  if ((requireAuthenticated && source.authenticated !== true) ||
      !Number.isInteger(id) || id <= 0 || source.role !== 'admin') {
    return { valid: false, actor: null };
  }

  return {
    valid: true,
    actor: {
      id,
      role: 'admin',
    },
  };
}

function normalizeProposalReference(value) {
  const reference = normalizeString(value);
  if (!reference || reference.length > MAXIMUM_PROPOSAL_REFERENCE_LENGTH) return null;
  return reference;
}

function normalizeProposalFingerprint(value) {
  const fingerprint = normalizeString(value);
  return HEX_FINGERPRINT_PATTERN.test(fingerprint) ? fingerprint : null;
}

function isProposalRegistryEntryExpired(entry, nowMs) {
  return !entry || !Number.isFinite(entry.expiresAtMs) || entry.expiresAtMs <= nowMs;
}

function buildProposalSummary(proposal = {}) {
  const source = asPlainObject(proposal);
  const provenance = asPlainObject(source.evidenceProvenance);
  const fingerprint = asPlainObject(provenance.projectionFingerprint);

  return {
    libraryId: Number.isInteger(provenance.libraryId) ? provenance.libraryId : null,
    proposalFingerprint: normalizeProposalFingerprint(fingerprint.fingerprint),
  };
}

function validateReadyPolicyIntentProposal(proposal, buildProposalAudit = buildPolicyLibraryIntentProposalAudit) {
  const source = asPlainObject(proposal);
  const summary = buildProposalSummary(source);
  let audit;

  try {
    audit = buildProposalAudit(source);
  } catch {
    return { valid: false, summary: null };
  }

  return {
    valid: audit?.ok === true &&
      source.ok === true &&
      source.statusId === POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.READY &&
      source.intent?.version === 'policy.intent.v1' &&
      Number.isInteger(summary.libraryId) &&
      summary.proposalFingerprint !== null,
    summary,
  };
}

function buildSideEffects({
  proposalRegistered = false,
  proposalResolved = false,
  proposalConsumed = false,
} = {}) {
  return {
    proposalRegistered,
    proposalResolved,
    proposalConsumed,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
    learningMutated: false,
    routingAttempted: false,
  };
}

function buildProposalRegistration(entry = null) {
  if (!entry) return null;

  return {
    proposalReference: entry.reference,
    proposalFingerprint: entry.proposalFingerprint,
    libraryId: entry.libraryId,
    expiresAt: new Date(entry.expiresAtMs).toISOString(),
  };
}

function buildRegistryResult({
  statusId,
  ok,
  issue = null,
  entry = null,
  proposalRegistered = false,
  proposalResolved = false,
  proposalConsumed = false,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_INTENT_PROPOSAL_REGISTRY_VERSION,
    ok,
    statusId,
    issueCount: issues.length,
    issues,
    registration: ok ? buildProposalRegistration(entry) : null,
    sideEffects: buildSideEffects({
      proposalRegistered,
      proposalResolved,
      proposalConsumed,
    }),
  };
}

function buildRegistryFailure(statusId, riskId, message, sideEffects = {}) {
  return buildRegistryResult({
    statusId,
    ok: false,
    issue: { riskId, message },
    ...sideEffects,
  });
}

function buildPolicyIntentProposalRegistryAudit(result = {}) {
  const registryResult = asPlainObject(result);
  const issues = [];
  const statusId = normalizeString(registryResult.statusId);
  const registration = asPlainObject(registryResult.registration);
  const sideEffects = asPlainObject(registryResult.sideEffects);

  if (!Object.values(POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS).includes(statusId)) {
    issues.push({
      riskId: POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.INVALID_RESULT,
      message: 'Policy intent proposal registry returned an unknown status.',
    });
  }

  if (registryResult.issueCount !== (Array.isArray(registryResult.issues) ? registryResult.issues.length : 0)) {
    issues.push({
      riskId: POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.INVALID_RESULT,
      message: 'Policy intent proposal registry issue count must match returned issues.',
    });
  }

  if (registryResult.ok === true &&
      (!normalizeProposalReference(registration.proposalReference) ||
       !normalizeProposalFingerprint(registration.proposalFingerprint) ||
       !Number.isInteger(registration.libraryId) ||
       Number.isNaN(new Date(registration.expiresAt).getTime()))) {
    issues.push({
      riskId: POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.INVALID_RESULT,
      message: 'Successful policy intent proposal registry results require bounded registration metadata.',
    });
  }

  if (registryResult.ok === true && ![
    POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.REGISTERED,
    POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.CONSUMED,
  ].includes(statusId)) {
    issues.push({
      riskId: POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.INVALID_RESULT,
      message: 'Only registration and one-time consumption can return successful registry results.',
    });
  }

  if (registryResult.ok !== true && registryResult.registration !== null) {
    issues.push({
      riskId: POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.INVALID_RESULT,
      message: 'Blocked policy intent proposal registry results must not disclose registration metadata.',
    });
  }

  if (['proposal', 'intent', 'evidenceProvenance'].some(key => Object.hasOwn(registryResult, key))) {
    issues.push({
      riskId: POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.INVALID_RESULT,
      message: 'Registry results must not expose the stored proposal or evidence provenance.',
    });
  }

  Object.entries(sideEffects).forEach(([sideEffectId, performed]) => {
    if (performed === true && ![
      'proposalRegistered',
      'proposalResolved',
      'proposalConsumed',
    ].includes(sideEffectId)) {
      issues.push({
        riskId: POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Policy intent proposal registry must not perform live lookups, writes, learning, or routing.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  DEFAULT_MAXIMUM_ENTRIES,
  DEFAULT_MAXIMUM_ENTRIES_PER_ACTOR,
  DEFAULT_PROPOSAL_TTL_MS,
  MAXIMUM_PROPOSAL_TTL_MS,
  POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS,
  POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS,
  POLICY_INTENT_PROPOSAL_REGISTRY_VERSION,
  buildPolicyIntentProposalRegistryAudit,
  buildRegistryFailure,
  buildRegistryResult,
  isProposalRegistryEntryExpired,
  normalizePositiveInteger,
  normalizeProposalFingerprint,
  normalizeProposalReference,
  normalizeRegistryActor,
  validateReadyPolicyIntentProposal,
};
