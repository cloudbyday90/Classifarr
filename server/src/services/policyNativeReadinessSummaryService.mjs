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
  buildPolicyAutomationReadinessFromContracts,
  validatePolicyAutomationReadiness,
} from './policyAutomationReadinessEngine.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from './policyLibraryProfileEvidenceLoader.mjs';
import {
  buildNativeContractFromRows,
  fetchActiveNativeIntentForPolicy,
} from './policyNativePolicyReadService.mjs';
import {
  buildNativeReadinessIntent,
} from './policyNativeReadinessIntent.mjs';
import {
  applyAutomaticProfileRecoveryToReadiness,
  buildNativeProfileRecoveryStatus,
  isStaleProfileReadiness,
} from './policyNativeProfileRecoveryStatus.mjs';
import {
  policyNativeProfileRefreshCandidateRepository,
} from './policyNativeProfileRefreshCandidateRepository.mjs';
import {
  buildPolicyNativeProfileRefreshRequest,
} from './policyNativeProfileRefreshRequest.mjs';
import {
  policyNativeProfileRefreshCircuitRepository,
} from './policyNativeProfileRefreshCircuitRepository.mjs';
import {
  buildAvailableNativeReadinessSummary,
  buildNativeIntentUnavailableResult,
  buildPolicyNativeReadinessSummaryAudit,
  buildPolicyNotFoundResult,
  buildReadUnavailableResult,
  normalizePositiveInteger,
} from './policyNativeReadinessSummaryContract.mjs';
import {
  fetchPolicyNativeReadinessContext,
} from './policyNativeReadinessPersistence.mjs';
import {
  findActivePolicyProfileRefreshOutboxRecord,
} from './policyProfileRefreshOutboxRepository.mjs';

function resolveProfileFreshness(profileHandoff = {}) {
  if (profileHandoff?.ok === true && profileHandoff.profileFreshness) {
    return profileHandoff.profileFreshness;
  }

  // Missing or unusable cached evidence must degrade to a safe refresh action.
  return { stale: true };
}

function buildSummarySideEffects({
  profileHandoff,
  profileRefreshOutboxRead = false,
  profileRefreshCircuitRead = false,
} = {}) {
  return {
    cachedProfileRead: profileHandoff?.sideEffects?.libraryProfileRead === true,
    profileRefreshOutboxRead,
    profileRefreshCircuitRead,
    routingConfigurationRead: true,
  };
}

async function readCurrentProfileRefreshCircuit({
  dbClient,
  libraryId,
  findProfileRefreshCandidate,
  buildProfileRefreshRequest,
  findProfileRefreshCircuit,
} = {}) {
  try {
    const candidate = await findProfileRefreshCandidate({
      client: dbClient,
      libraryId,
    });
    const request = buildProfileRefreshRequest(candidate || {});
    if (request.ready !== true) {
      return { circuit: null, profileRefreshCircuitRead: false };
    }

    const circuit = await findProfileRefreshCircuit({
      client: dbClient,
      libraryId,
      sourceEventId: request.record.sourceEventId,
    });
    return { circuit, profileRefreshCircuitRead: true };
  } catch {
    // This optional status enrichment must not make the core readiness read unavailable.
    return { circuit: null, profileRefreshCircuitRead: false };
  }
}

function createPolicyNativeReadinessSummaryService({
  fetchContext = fetchPolicyNativeReadinessContext,
  fetchNativeIntent = fetchActiveNativeIntentForPolicy,
  loadProfileEvidence = loadPolicyLibraryProfileEvidence,
  findActiveProfileRefresh = findActivePolicyProfileRefreshOutboxRecord,
  findProfileRefreshCandidate =
    policyNativeProfileRefreshCandidateRepository.findCandidateForLibrary,
  buildProfileRefreshRequest = buildPolicyNativeProfileRefreshRequest,
  findProfileRefreshCircuit = policyNativeProfileRefreshCircuitRepository.find,
  buildReadiness = buildPolicyAutomationReadinessFromContracts,
  validateReadiness = validatePolicyAutomationReadiness,
} = {}) {
  async function getSummary({ dbClient, policyId } = {}) {
    const normalizedPolicyId = normalizePositiveInteger(policyId);
    if (!normalizedPolicyId || typeof dbClient?.query !== 'function') {
      return buildReadUnavailableResult({ policyId: normalizedPolicyId });
    }

    try {
      const context = await fetchContext(dbClient, normalizedPolicyId);
      if (!context?.policy?.id || !context?.policy?.libraryId) {
        return buildPolicyNotFoundResult(normalizedPolicyId);
      }

      const nativeIntent = await fetchNativeIntent(dbClient, normalizedPolicyId);
      if (!nativeIntent?.intent || nativeIntent.authority?.authoritative !== true) {
        return buildNativeIntentUnavailableResult({
          policyId: normalizedPolicyId,
          authority: nativeIntent?.authority,
          intentVersion: nativeIntent?.intent?.intent_version,
          sideEffects: { routingConfigurationRead: true },
        });
      }

      const profileHandoff = await loadProfileEvidence({ libraryId: context.policy.libraryId });
      const nativeContract = buildNativeContractFromRows({
        policy: {
          id: context.policy.id,
          library_id: context.policy.libraryId,
        },
        ...nativeIntent,
      });
      const readinessInput = {
        intent: buildNativeReadinessIntent(nativeContract),
        routing: context.routing,
        profileFreshness: resolveProfileFreshness(profileHandoff),
        // A policy-level read does not evaluate a media item, so it cannot infer a hard-limit conflict.
        hardLimitConflict: false,
      };
      if (profileHandoff?.ok === true && profileHandoff.evidenceBoundary?.projection) {
        readinessInput.evidenceProjection = profileHandoff.evidenceBoundary.projection;
      }
      const readiness = buildReadiness(readinessInput);
      if (validateReadiness(readiness).ok !== true) {
        return buildReadUnavailableResult({
          policyId: normalizedPolicyId,
          sideEffects: buildSummarySideEffects({ profileHandoff }),
        });
      }

      const profileRefreshOutboxRead = isStaleProfileReadiness(readiness);
      const activeRefresh = profileRefreshOutboxRead
        ? await findActiveProfileRefresh({
          client: dbClient,
          libraryId: context.policy.libraryId,
        })
        : null;
      let circuit = null;
      let profileRefreshCircuitRead = false;
      if (profileRefreshOutboxRead && !activeRefresh?.id) {
        ({ circuit, profileRefreshCircuitRead } = await readCurrentProfileRefreshCircuit({
          dbClient,
          libraryId: context.policy.libraryId,
          findProfileRefreshCandidate,
          buildProfileRefreshRequest,
          findProfileRefreshCircuit,
        }));
      }
      const profileRecovery = buildNativeProfileRecoveryStatus({
        readiness,
        activeRefresh,
        circuit,
      });
      const displayReadiness = applyAutomaticProfileRecoveryToReadiness({
        readiness,
        profileRecovery,
      });

      const summary = buildAvailableNativeReadinessSummary({
        policyId: normalizedPolicyId,
        nativeIntent,
        nativeContract,
        readiness: displayReadiness,
        profileRecovery,
        sideEffects: buildSummarySideEffects({
          profileHandoff,
          profileRefreshOutboxRead,
          profileRefreshCircuitRead,
        }),
      });

      return buildPolicyNativeReadinessSummaryAudit(summary).ok
        ? summary
        : buildReadUnavailableResult({
          policyId: normalizedPolicyId,
          sideEffects: buildSummarySideEffects({
            profileHandoff,
            profileRefreshOutboxRead,
            profileRefreshCircuitRead,
          }),
        });
    } catch {
      return buildReadUnavailableResult({ policyId: normalizedPolicyId });
    }
  }

  return { getSummary };
}

const policyNativeReadinessSummaryService = createPolicyNativeReadinessSummaryService();

export {
  createPolicyNativeReadinessSummaryService,
  policyNativeReadinessSummaryService,
  readCurrentProfileRefreshCircuit,
  resolveProfileFreshness,
};
