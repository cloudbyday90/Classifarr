/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomBytes } from 'node:crypto';

import {
  buildPolicyLibraryIntentProposalAudit,
} from './policyLibraryIntentProposalService.mjs';
import {
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
} from './policyIntentProposalRegistryContract.mjs';

const MAXIMUM_REFERENCE_GENERATION_ATTEMPTS = 3;

function buildReference() {
  return randomBytes(32).toString('base64url');
}

function cloneProposal(proposal) {
  try {
    return structuredClone(proposal);
  } catch {
    return null;
  }
}

function isEntryOwnedBy(entry, actor) {
  return entry?.actorId === actor.id;
}

function createPolicyIntentProposalRegistry({
  now = () => Date.now(),
  createReference = buildReference,
  buildProposalAudit = buildPolicyLibraryIntentProposalAudit,
  proposalTtlMs = DEFAULT_PROPOSAL_TTL_MS,
  maximumEntries = DEFAULT_MAXIMUM_ENTRIES,
  maximumEntriesPerActor = DEFAULT_MAXIMUM_ENTRIES_PER_ACTOR,
} = {}) {
  const ttlMs = normalizePositiveInteger(proposalTtlMs, DEFAULT_PROPOSAL_TTL_MS, MAXIMUM_PROPOSAL_TTL_MS);
  const maximum = normalizePositiveInteger(maximumEntries, DEFAULT_MAXIMUM_ENTRIES, DEFAULT_MAXIMUM_ENTRIES);
  const maximumPerActor = Math.min(
    normalizePositiveInteger(maximumEntriesPerActor, DEFAULT_MAXIMUM_ENTRIES_PER_ACTOR, DEFAULT_MAXIMUM_ENTRIES),
    maximum,
  );
  const entries = new Map();

  function getNowMs() {
    const value = Number(now());
    return Number.isFinite(value) ? value : Date.now();
  }

  function removeExpiredEntries(nowMs = getNowMs()) {
    for (const [reference, entry] of entries.entries()) {
      if (isProposalRegistryEntryExpired(entry, nowMs)) entries.delete(reference);
    }
  }

  function countEntriesForActor(actorId) {
    return [...entries.values()].filter(entry => entry.actorId === actorId).length;
  }

  function createUniqueReference() {
    for (let attempt = 0; attempt < MAXIMUM_REFERENCE_GENERATION_ATTEMPTS; attempt += 1) {
      let reference;
      try {
        reference = normalizeProposalReference(createReference());
      } catch {
        return null;
      }
      if (reference && !entries.has(reference)) return reference;
    }
    return null;
  }

  function registerProposal({ proposal, actor } = {}) {
    const actorResult = normalizeRegistryActor(actor);
    if (!actorResult.valid) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.UNAUTHORIZED_ACTOR,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.UNAUTHORIZED_ACTOR,
        'Policy intent proposal registration requires an authenticated administrator.',
      );
    }

    const proposalResult = validateReadyPolicyIntentProposal(proposal, buildProposalAudit);
    if (!proposalResult.valid) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.INVALID_PROPOSAL,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.INVALID_PROPOSAL,
        'Only a verified ready policy intent proposal can be registered.',
      );
    }

    const snapshot = cloneProposal(proposal);
    if (!snapshot) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.REGISTRY_FAILED,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.REGISTRY_FAILED,
        'Policy intent proposal could not be registered.',
      );
    }

    const nowMs = getNowMs();
    removeExpiredEntries(nowMs);
    if (entries.size >= maximum) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.REGISTRY_CAPACITY_REACHED,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.REGISTRY_CAPACITY_REACHED,
        'The policy intent proposal registry is at capacity. Try again after an existing proposal expires.',
      );
    }

    if (countEntriesForActor(actorResult.actor.id) >= maximumPerActor) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.ACTOR_CAPACITY_REACHED,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.ACTOR_CAPACITY_REACHED,
        'The authenticated administrator has too many active policy intent proposals.',
      );
    }

    const reference = createUniqueReference();
    if (!reference) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.REGISTRY_FAILED,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.REGISTRY_FAILED,
        'Policy intent proposal could not be registered.',
      );
    }

    const entry = {
      reference,
      actorId: actorResult.actor.id,
      libraryId: proposalResult.summary.libraryId,
      proposalFingerprint: proposalResult.summary.proposalFingerprint,
      proposal: snapshot,
      expiresAtMs: nowMs + ttlMs,
    };
    entries.set(reference, entry);

    return buildRegistryResult({
      statusId: POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.REGISTERED,
      ok: true,
      entry,
      proposalRegistered: true,
    });
  }

  function resolveStoredProposal({ proposalReference, actor } = {}, actorOptions) {
    const actorResult = normalizeRegistryActor(actor, actorOptions);
    const reference = normalizeProposalReference(proposalReference);
    if (!actorResult.valid || !reference) return null;

    const entry = entries.get(reference);
    const nowMs = getNowMs();
    if (isProposalRegistryEntryExpired(entry, nowMs)) {
      entries.delete(reference);
      return null;
    }
    if (!isEntryOwnedBy(entry, actorResult.actor)) return null;

    return cloneProposal(entry.proposal);
  }

  function resolveProposal(input = {}) {
    return resolveStoredProposal(input, { requireAuthenticated: true });
  }

  function resolveProposalForCommand(input = {}) {
    return resolveStoredProposal(input, { requireAuthenticated: false });
  }

  function consumeProposal({ proposalReference, proposalFingerprint, actor } = {}) {
    const actorResult = normalizeRegistryActor(actor);
    if (!actorResult.valid) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.UNAUTHORIZED_ACTOR,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.UNAUTHORIZED_ACTOR,
        'Policy intent proposal consumption requires an authenticated administrator.',
      );
    }

    const reference = normalizeProposalReference(proposalReference);
    const fingerprint = normalizeProposalFingerprint(proposalFingerprint);
    if (!reference || !fingerprint) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.INVALID_REFERENCE,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.INVALID_REFERENCE,
        'Policy intent proposal consumption requires a valid reference and fingerprint.',
      );
    }

    const entry = entries.get(reference);
    if (!entry || !isEntryOwnedBy(entry, actorResult.actor)) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.PROPOSAL_UNAVAILABLE,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.PROPOSAL_UNAVAILABLE,
        'The server-owned policy intent proposal is unavailable.',
      );
    }

    if (isProposalRegistryEntryExpired(entry, getNowMs())) {
      entries.delete(reference);
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.PROPOSAL_EXPIRED,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.PROPOSAL_EXPIRED,
        'The server-owned policy intent proposal has expired.',
      );
    }

    if (entry.proposalFingerprint !== fingerprint) {
      return buildRegistryFailure(
        POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.PROPOSAL_FINGERPRINT_MISMATCH,
        POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS.PROPOSAL_FINGERPRINT_MISMATCH,
        'The policy intent proposal fingerprint no longer matches the server-owned proposal.',
      );
    }

    entries.delete(reference);
    return buildRegistryResult({
      statusId: POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.CONSUMED,
      ok: true,
      entry,
      proposalConsumed: true,
    });
  }

  return {
    registerProposal,
    resolveProposal,
    resolveProposalForCommand,
    consumeProposal,
  };
}

const policyIntentProposalRegistry = createPolicyIntentProposalRegistry();

export {
  DEFAULT_MAXIMUM_ENTRIES,
  DEFAULT_MAXIMUM_ENTRIES_PER_ACTOR,
  DEFAULT_PROPOSAL_TTL_MS,
  POLICY_INTENT_PROPOSAL_REGISTRY_RISK_IDS,
  POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS,
  POLICY_INTENT_PROPOSAL_REGISTRY_VERSION,
  buildPolicyIntentProposalRegistryAudit,
  createPolicyIntentProposalRegistry,
  policyIntentProposalRegistry,
};
