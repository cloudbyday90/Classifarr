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
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS,
  buildPolicyNativeIntentPurposeChangeProvenance,
} from './policyNativeIntentPurposeChangeProvenance.mjs';
import {
  buildStoredPurposeChangeCommand,
  buildStoredPurposeChangeCommandSignature,
} from './policyNativeIntentPurposeChangeCommandProjection.mjs';

export const POLICY_PURPOSE_PROPOSAL_BATCH_VERSION = 1;
export const POLICY_PURPOSE_PROPOSAL_BATCH_MAX_POLICY_COUNT = 25;

export const POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS = Object.freeze({
  READY_FOR_APPLY: 'ready_for_apply',
  NO_COMPATIBLE_PROPOSALS: 'no_compatible_proposals',
  INDIVIDUAL_REVIEW_REQUIRED: 'individual_review_required',
  REVIEW_WINDOW_TRUNCATED: 'review_window_truncated',
  APPLIED: 'applied',
  REPLAYED: 'replayed',
  REQUEST_INVALID: 'request_invalid',
  PROPOSAL_STALE: 'proposal_stale',
  REPLAY_INCOMPLETE: 'replay_incomplete',
  TRANSACTION_UNAVAILABLE: 'transaction_unavailable',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

export const POLICY_PURPOSE_PROPOSAL_BATCH_ACTION_ID = 'apply_reviewed_purpose_proposals';

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asPositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function asNonEmptyString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeRecord(record = {}) {
  const policyId = asPositiveInteger(record.policy_id);
  const libraryId = asPositiveInteger(record.library_id);
  const revision = asPositiveInteger(record.intent_version);
  const purposeRules = asArray(record.purpose_rules);
  if (!policyId || !libraryId || !revision || purposeRules.length === 0) return null;

  const purposeProvenance = buildPolicyNativeIntentPurposeChangeProvenance(purposeRules);
  if (!purposeProvenance.declarationRequired) return null;

  let command;
  let commandSignature;
  try {
    command = buildStoredPurposeChangeCommand(purposeRules);
    commandSignature = buildStoredPurposeChangeCommandSignature(purposeRules);
  } catch {
    return null;
  }

  return {
    policyId,
    revision,
    command,
    commandSignature,
    purposeProvenance,
    presentation: {
      policy: {
        id: policyId,
        name: asNonEmptyString(record.policy_name, 'Unnamed policy'),
      },
      library: {
        id: libraryId,
        name: asNonEmptyString(record.library_name, 'Unnamed library'),
        mediaType: asNonEmptyString(record.library_media_type, null),
      },
    },
  };
}

function createProposalFingerprint(candidates) {
  const material = candidates.map(candidate => ({
    policyId: candidate.policyId,
    revision: candidate.revision,
    commandSignature: candidate.commandSignature,
  }));
  return `sha256:${createHash('sha256').update(JSON.stringify(material), 'utf8').digest('hex')}`;
}

function presentEntry(entry) {
  return {
    ...entry.presentation,
    purposeProvenance: entry.purposeProvenance,
  };
}

function presentPlan({ statusId, candidates, exceptions, truncated, proposalFingerprint = null }) {
  const candidatePolicyIds = candidates.map(candidate => candidate.policyId);
  const actionAvailable = statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.READY_FOR_APPLY;

  return {
    version: `policy_purpose_proposal_batch.v${POLICY_PURPOSE_PROPOSAL_BATCH_VERSION}`,
    statusId,
    proposalFingerprint: actionAvailable ? proposalFingerprint : null,
    summary: {
      candidatePolicyCount: candidates.length,
      exceptionPolicyCount: exceptions.length,
      reviewedPolicyCount: candidates.length + exceptions.length,
      truncated: truncated === true,
    },
    candidates: candidates.map(presentEntry),
    exceptions: exceptions.map(presentEntry),
    action: {
      actionId: POLICY_PURPOSE_PROPOSAL_BATCH_ACTION_ID,
      available: actionAvailable,
      candidatePolicyIds: actionAvailable ? candidatePolicyIds : [],
    },
    rawPurposeRulesExposed: false,
    policyStorageMutated: false,
    semanticSelectionAffected: false,
    routingAffected: false,
    providerAccessed: false,
  };
}

/**
 * Creates a server-only plan. A profile-derived draft can be included in one
 * explicit batch, but a mixed or unverified draft remains an individual
 * exception. Rule values stay inside this plan and never enter the response.
 */
export function buildPolicyPurposeProposalBatchPlan({ records = [], truncated = false } = {}) {
  const entries = asArray(records)
    .map(normalizeRecord)
    .filter(Boolean)
    .sort((left, right) => left.policyId - right.policyId);
  const candidates = entries.filter(entry => (
    entry.purposeProvenance.id === POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.PROFILE_DERIVED
  ));
  const exceptions = entries.filter(entry => !candidates.includes(entry));

  let statusId = POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.NO_COMPATIBLE_PROPOSALS;
  if (truncated === true) {
    statusId = POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REVIEW_WINDOW_TRUNCATED;
  } else if (candidates.length > 0) {
    statusId = POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.READY_FOR_APPLY;
  } else if (exceptions.length > 0) {
    statusId = POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.INDIVIDUAL_REVIEW_REQUIRED;
  }

  const proposalFingerprint = statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.READY_FOR_APPLY
    ? createProposalFingerprint(candidates)
    : null;

  return {
    presentation: presentPlan({
      statusId,
      candidates,
      exceptions,
      truncated,
      proposalFingerprint,
    }),
    candidates,
    proposalFingerprint,
  };
}

export function validatePolicyPurposeProposalBatchRequest(body = {}) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  if (!payload) return { valid: false };

  const allowedFields = new Set(['proposal_fingerprint', 'candidate_policy_ids']);
  if (Object.keys(payload).some(key => !allowedFields.has(key))) return { valid: false };

  const proposalFingerprint = typeof payload.proposal_fingerprint === 'string'
    ? payload.proposal_fingerprint.trim()
    : '';
  const candidatePolicyIds = asArray(payload.candidate_policy_ids).map(asPositiveInteger);
  if (
    !FINGERPRINT_PATTERN.test(proposalFingerprint) ||
    candidatePolicyIds.length === 0 ||
    candidatePolicyIds.length > POLICY_PURPOSE_PROPOSAL_BATCH_MAX_POLICY_COUNT ||
    candidatePolicyIds.some(value => value === null)
  ) {
    return { valid: false };
  }

  const sortedPolicyIds = [...candidatePolicyIds].sort((left, right) => left - right);
  if (sortedPolicyIds.some((value, index) => index > 0 && value === sortedPolicyIds[index - 1])) {
    return { valid: false };
  }

  return {
    valid: true,
    proposalFingerprint,
    candidatePolicyIds: sortedPolicyIds,
  };
}

export function isExactPolicyPurposeProposalBatch(plan, request) {
  return plan?.proposalFingerprint === request?.proposalFingerprint &&
    JSON.stringify(plan?.candidates?.map(candidate => candidate.policyId) || []) ===
      JSON.stringify(request?.candidatePolicyIds || []);
}
