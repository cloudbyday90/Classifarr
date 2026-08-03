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
  validatePolicyInitialIntentEstablishmentRequest,
} from './policyInitialIntentEstablishmentContract.mjs';
import {
  PolicyNativeIntentCreateConflictError,
  createNativeIntentPolicyInTransaction,
} from './policyNativeIntentCreateService.mjs';
import {
  POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS,
  buildPolicyLibraryProfileInitialIntentContract,
} from './policyLibraryProfileInitialIntent.mjs';
import {
  buildPolicyAuthoringNativePolicy,
} from './policyAuthoringProposalDefaults.mjs';
import {
  applyPolicyAuthoringProposalAdjustmentCommands,
  buildPolicyAuthoringProposalAdjustmentPresentation,
} from './policyAuthoringProposalAdjustmentContract.mjs';
import {
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS,
  POLICY_AUTHORING_PROPOSAL_STATUS_IDS,
  POLICY_AUTHORING_PROPOSAL_VERSION,
  buildPolicyAuthoringProposalCandidate,
  normalizePolicyAuthoringProposalReference,
  parseStoredPolicyAuthoringProposal,
  policyAuthoringProposalIsExpired,
  stableJson,
} from './policyAuthoringProposalContract.mjs';
import {
  consumePolicyAuthoringProposal,
  insertPolicyAuthoringProposal,
  lockPolicyAuthoringProposal,
  readPolicyAuthoringLibrary,
  readPolicyAuthoringLibraryPolicy,
  readPolicyAuthoringLibraryProfile,
} from './policyAuthoringProposalPersistence.mjs';

const POLICY_AUTHORING_PROPOSAL_TTL_MS = 15 * 60 * 1000;

function normalizeActorId(value) {
  const actorId = Number(value);
  return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatLifecycleLibrary(library = {}) {
  return {
    id: Number(library.id),
    name: typeof library.name === 'string' ? library.name : null,
    mediaType: typeof library.media_type === 'string' ? library.media_type : null,
  };
}

function buildLifecycleAction(statusId) {
  if (statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL) {
    return {
      id: 'prepare_proposal',
      available: true,
    };
  }

  if (statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROFILE_RECOVERY_REQUIRED) {
    return {
      id: 'refresh_profile',
      available: false,
    };
  }

  return {
    id: 'inspect_policy',
    available: false,
  };
}

function buildLifecycleResult({ library, policy = null, profileInitialIntent = null, candidate = null } = {}) {
  if (!library) {
    return {
      version: POLICY_AUTHORING_PROPOSAL_VERSION,
      statusId: POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.LIBRARY_NOT_FOUND,
      library: null,
      action: buildLifecycleAction(POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.LIBRARY_NOT_FOUND),
      proposal: { available: false, reasonId: 'library_not_found' },
    };
  }

  if (policy) {
    const statusId = policy.has_native_intent === true
      ? POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_NATIVE_POLICY
      : POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_COMPATIBILITY_POLICY;

    return {
      version: POLICY_AUTHORING_PROPOSAL_VERSION,
      statusId,
      library: formatLifecycleLibrary(library),
      action: buildLifecycleAction(statusId),
      policy: {
        id: Number(policy.id),
        name: typeof policy.name === 'string' ? policy.name : null,
      },
      proposal: { available: false, reasonId: statusId },
    };
  }

  if (candidate) {
    const statusId = POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL;
    return {
      version: POLICY_AUTHORING_PROPOSAL_VERSION,
      statusId,
      library: formatLifecycleLibrary(library),
      action: buildLifecycleAction(statusId),
      policy: null,
      proposal: {
        available: true,
        reasonId: 'current_profile_candidate_available',
      },
    };
  }

  const profileStatusId = profileInitialIntent?.statusId;
  const recoveryRequired = [
    POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.PROFILE_MISSING,
    POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.PROFILE_STALE,
  ].includes(profileStatusId);
  const statusId = recoveryRequired
    ? POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROFILE_RECOVERY_REQUIRED
    : POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROPOSAL_UNAVAILABLE;

  return {
    version: POLICY_AUTHORING_PROPOSAL_VERSION,
    statusId,
    library: formatLifecycleLibrary(library),
    action: buildLifecycleAction(statusId),
    policy: null,
    proposal: {
      available: false,
      reasonId: recoveryRequired
        ? 'profile_not_current'
        : 'profile_does_not_support_a_safe_proposal',
    },
  };
}

function buildProfileInitialIntent({ library, profile, now, buildInitialIntent }) {
  return buildInitialIntent({
    policy: {
      library_id: library.id,
      library_name: library.name,
      library_media_type: library.media_type,
      libraryProfile: profile || {},
    },
    now,
  });
}

function buildCandidateContext({ library, profile, now, buildInitialIntent }) {
  const profileInitialIntent = buildProfileInitialIntent({
    library,
    profile,
    now,
    buildInitialIntent,
  });
  const candidate = buildPolicyAuthoringProposalCandidate({
    library,
    profileInitialIntent,
  });

  return { profileInitialIntent, candidate };
}

function buildPreparedProposalResponse({ lifecycle, proposal }) {
  return {
    version: POLICY_AUTHORING_PROPOSAL_VERSION,
    statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PREPARED,
    lifecycle,
    proposal: {
      reference: proposal.reference,
      revision: proposal.proposalRevision,
      expiresAt: proposal.expiresAt,
      summary: proposal.displaySummary,
      adjustment: buildPolicyAuthoringProposalAdjustmentPresentation(proposal.declaredIntent),
    },
  };
}

function buildAdmissionResult({ statusId, policy = null } = {}) {
  return {
    version: POLICY_AUTHORING_PROPOSAL_VERSION,
    statusId,
    policy: policy
      ? {
        id: Number(policy.id),
        libraryId: Number(policy.library_id),
        name: typeof policy.name === 'string' ? policy.name : null,
      }
      : null,
    recovery: {
      lifecycleReloadRequired: ![
        POLICY_AUTHORING_PROPOSAL_STATUS_IDS.CREATED,
        POLICY_AUTHORING_PROPOSAL_STATUS_IDS.REPLAYED,
      ].includes(statusId),
    },
  };
}

function proposalMatchesCandidate(proposal, candidate) {
  return proposal?.proposalRevision === candidate?.proposalRevision &&
    proposal?.profileFingerprint === candidate?.profileFingerprint &&
    proposal?.policyName === candidate?.policyName &&
    stableJson(proposal?.declaredIntent) === stableJson(candidate?.declaredIntent);
}

function buildEstablishmentRequest({ idempotencyKey, declaredIntent }) {
  try {
    return validatePolicyInitialIntentEstablishmentRequest({
      schema_version: 1,
      idempotency_key: idempotencyKey,
      declared_intent: declaredIntent,
    });
  } catch {
    return null;
  }
}

function isUniqueConstraintError(error) {
  return error?.code === '23505';
}

function mapNativeCreateConflict(error) {
  if (error instanceof PolicyNativeIntentCreateConflictError) {
    if (error.code === 'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_IN_PROGRESS') {
      return POLICY_AUTHORING_PROPOSAL_STATUS_IDS.REQUEST_IN_PROGRESS;
    }
    if (error.code === 'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_REUSED') {
      return POLICY_AUTHORING_PROPOSAL_STATUS_IDS.IDEMPOTENCY_KEY_REUSED;
    }
    return POLICY_AUTHORING_PROPOSAL_STATUS_IDS.EXISTING_POLICY;
  }

  return isUniqueConstraintError(error)
    ? POLICY_AUTHORING_PROPOSAL_STATUS_IDS.EXISTING_POLICY
    : null;
}

function isNativeCreateReplay(result) {
  return result?.nativeIntentEstablishment?.establishment?.replayed === true;
}

function createProposalReference() {
  return randomBytes(32).toString('base64url');
}

function createPolicyAuthoringProposalLifecycleService({
  buildInitialIntent = buildPolicyLibraryProfileInitialIntentContract,
  proposalReferenceFactory = createProposalReference,
  proposalTtlMs = POLICY_AUTHORING_PROPOSAL_TTL_MS,
  persistence = {
    readLibrary: readPolicyAuthoringLibrary,
    readPolicy: readPolicyAuthoringLibraryPolicy,
    readProfile: readPolicyAuthoringLibraryProfile,
    insertProposal: insertPolicyAuthoringProposal,
    lockProposal: lockPolicyAuthoringProposal,
    consumeProposal: consumePolicyAuthoringProposal,
  },
  createNativePolicy = createNativeIntentPolicyInTransaction,
} = {}) {
  async function getLifecycle({ db, libraryId, now = new Date() } = {}) {
    const library = await persistence.readLibrary({ dbClient: db, libraryId });
    if (!library) return buildLifecycleResult();

    const policy = await persistence.readPolicy({ dbClient: db, libraryId });
    if (policy) return buildLifecycleResult({ library, policy });

    const profile = await persistence.readProfile({ dbClient: db, libraryId });
    const context = buildCandidateContext({
      library,
      profile,
      now: normalizeDate(now),
      buildInitialIntent,
    });

    return buildLifecycleResult({ library, ...context });
  }

  async function prepareProposal({ db, libraryId, actorId, now = new Date() } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    if (!normalizedActorId || typeof db?.withTransaction !== 'function') {
      throw new TypeError('Preparing a policy authoring proposal requires a transaction and administrator actor.');
    }

    const currentTime = normalizeDate(now);
    return db.withTransaction(async client => {
      const library = await persistence.readLibrary({ dbClient: client, libraryId, lock: true });
      if (!library) return buildLifecycleResult();

      const policy = await persistence.readPolicy({ dbClient: client, libraryId, lock: true });
      if (policy) return buildLifecycleResult({ library, policy });

      const profile = await persistence.readProfile({ dbClient: client, libraryId, lock: true });
      const context = buildCandidateContext({
        library,
        profile,
        now: currentTime,
        buildInitialIntent,
      });
      const lifecycle = buildLifecycleResult({ library, ...context });
      if (!context.candidate) return lifecycle;

      const expiresAt = new Date(currentTime.getTime() + proposalTtlMs).toISOString();
      const proposalReference = normalizePolicyAuthoringProposalReference(proposalReferenceFactory());
      if (!proposalReference) {
        throw new Error('Policy authoring proposal reference factory returned an invalid reference.');
      }

      const inserted = await persistence.insertProposal({
        client,
        proposalReference,
        libraryId,
        actorId: normalizedActorId,
        proposalRevision: context.candidate.proposalRevision,
        profileFingerprint: context.candidate.profileFingerprint,
        policyName: context.candidate.policyName,
        declaredIntent: context.candidate.declaredIntent,
        displaySummary: context.candidate.displaySummary,
        expiresAt,
      });
      const proposal = parseStoredPolicyAuthoringProposal(inserted);
      if (!proposal) {
        throw new Error('Policy authoring proposal persistence returned an invalid record.');
      }

      return buildPreparedProposalResponse({ lifecycle, proposal });
    });
  }

  async function admitProposal({
    db,
    libraryId,
    actorId,
    proposalReference,
    proposalRevision,
    idempotencyKey,
    adjustmentCommands = [],
    now = new Date(),
  } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const normalizedReference = normalizePolicyAuthoringProposalReference(proposalReference);
    if (!normalizedActorId || !normalizedReference || typeof db?.withTransaction !== 'function') {
      throw new TypeError('Admitting a policy authoring proposal requires a transaction, administrator actor, and proposal reference.');
    }

    const currentTime = normalizeDate(now);
    return db.withTransaction(async client => {
      const proposal = parseStoredPolicyAuthoringProposal(await persistence.lockProposal({
        client,
        proposalReference: normalizedReference,
      }));
      if (!proposal || proposal.libraryId !== Number(libraryId) || proposal.actorId !== normalizedActorId) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_UNAVAILABLE,
        });
      }

      if (proposal.proposalRevision !== proposalRevision) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_STALE,
        });
      }

      const adjustedStoredDeclaredIntent = applyPolicyAuthoringProposalAdjustmentCommands({
        declaredIntent: proposal.declaredIntent,
        adjustmentCommands,
      });
      if (!adjustedStoredDeclaredIntent) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_STALE,
        });
      }

      const establishmentRequest = buildEstablishmentRequest({
        idempotencyKey,
        declaredIntent: adjustedStoredDeclaredIntent,
      });
      if (!establishmentRequest) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_UNAVAILABLE,
        });
      }

      const library = await persistence.readLibrary({ dbClient: client, libraryId, lock: true });
      if (!library) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_UNAVAILABLE,
        });
      }

      if (proposal.state === 'consumed') {
        try {
          const result = await createNativePolicy({
            client,
            policy: buildPolicyAuthoringNativePolicy({
              libraryId,
              policyName: proposal.policyName,
            }),
            actorId: normalizedActorId,
            establishmentRequest,
          });
          return buildAdmissionResult({
            statusId: isNativeCreateReplay(result)
              ? POLICY_AUTHORING_PROPOSAL_STATUS_IDS.REPLAYED
              : POLICY_AUTHORING_PROPOSAL_STATUS_IDS.CREATED,
            policy: result.policy,
          });
        } catch (error) {
          const statusId = mapNativeCreateConflict(error);
          if (statusId) return buildAdmissionResult({ statusId });
          throw error;
        }
      }

      if (policyAuthoringProposalIsExpired(proposal, currentTime)) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_EXPIRED,
        });
      }

      const policy = await persistence.readPolicy({ dbClient: client, libraryId, lock: true });
      if (policy) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.EXISTING_POLICY,
        });
      }

      const profile = await persistence.readProfile({ dbClient: client, libraryId, lock: true });
      const context = buildCandidateContext({
        library,
        profile,
        now: currentTime,
        buildInitialIntent,
      });
      if (!context.candidate || !proposalMatchesCandidate(proposal, context.candidate)) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_STALE,
        });
      }

      const adjustedDeclaredIntent = applyPolicyAuthoringProposalAdjustmentCommands({
        declaredIntent: context.candidate.declaredIntent,
        adjustmentCommands,
      });
      if (!adjustedDeclaredIntent) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_STALE,
        });
      }

      const currentEstablishmentRequest = buildEstablishmentRequest({
        idempotencyKey,
        declaredIntent: adjustedDeclaredIntent,
      });
      if (!currentEstablishmentRequest) {
        return buildAdmissionResult({
          statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_STALE,
        });
      }

      try {
        const result = await createNativePolicy({
          client,
          policy: buildPolicyAuthoringNativePolicy({
            libraryId,
            policyName: context.candidate.policyName,
          }),
          actorId: normalizedActorId,
          establishmentRequest: currentEstablishmentRequest,
        });
        const consumed = await persistence.consumeProposal({
          client,
          proposalId: proposal.id,
          policyId: result.policy.id,
          now: currentTime.toISOString(),
        });
        if (!consumed) {
          throw new Error('Policy authoring proposal could not be consumed after native policy creation.');
        }

        return buildAdmissionResult({
          statusId: isNativeCreateReplay(result)
            ? POLICY_AUTHORING_PROPOSAL_STATUS_IDS.REPLAYED
            : POLICY_AUTHORING_PROPOSAL_STATUS_IDS.CREATED,
          policy: result.policy,
        });
      } catch (error) {
        const statusId = mapNativeCreateConflict(error);
        if (statusId) return buildAdmissionResult({ statusId });
        throw error;
      }
    });
  }

  return {
    admitProposal,
    getLifecycle,
    prepareProposal,
  };
}

const policyAuthoringProposalLifecycleService = createPolicyAuthoringProposalLifecycleService();

export {
  POLICY_AUTHORING_PROPOSAL_TTL_MS,
  buildCandidateContext,
  buildLifecycleResult,
  createPolicyAuthoringProposalLifecycleService,
  policyAuthoringProposalLifecycleService,
};
