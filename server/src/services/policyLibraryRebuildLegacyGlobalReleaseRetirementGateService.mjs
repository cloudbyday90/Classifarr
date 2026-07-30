/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  buildPolicyLibraryRebuildLegacyDeletionReadiness,
} from './policyLibraryRebuildLegacyDeletionReadiness.mjs';
import {
  buildPolicyLibraryRebuildLegacyFinalRemovalPlan,
} from './policyLibraryRebuildLegacyFinalRemovalPlan.mjs';
import {
  buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate,
  validatePolicyLibraryRebuildLegacyGlobalReleaseRetirementGate,
} from './policyLibraryRebuildLegacyGlobalReleaseRetirementGate.mjs';
import {
  loadPolicyLibraryRebuildLegacyEnabledPolicyInventory,
} from './policyLibraryRebuildLegacyGlobalReleaseRetirementRepository.mjs';
import {
  buildPolicyLibraryRebuildLegacyRemovalInventory,
} from './policyLibraryRebuildLegacyRemovalInventory.mjs';
import {
  loadPolicyLibraryRebuildLegacyDeletionEvidence,
} from './policyLibraryRebuildLegacyDeletionReadinessRepository.mjs';

function normalizeExecutionTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function policyIdFromContext(value = {}) {
  const policyId = Number(value.policyId ?? value.policy_id ?? value.id);
  return Number.isInteger(policyId) && policyId > 0 ? policyId : null;
}

function addDatabaseRead(gate, databaseRead) {
  const result = {
    ...gate,
    sideEffects: {
      ...gate.sideEffects,
      databaseRead,
    },
  };

  return {
    ...result,
    validation: validatePolicyLibraryRebuildLegacyGlobalReleaseRetirementGate(result),
  };
}

function buildBoundaryUnavailableResult({ now, removalInventory = null }) {
  return buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate({
    removalInventory,
    evidenceBoundaryAvailable: false,
    now,
  });
}

function createPolicyLibraryRebuildLegacyGlobalReleaseRetirementGateService({
  dbClient = defaultDb,
  loadEnabledPolicyInventory = loadPolicyLibraryRebuildLegacyEnabledPolicyInventory,
  loadEvidence = loadPolicyLibraryRebuildLegacyDeletionEvidence,
  buildRemovalInventory = buildPolicyLibraryRebuildLegacyRemovalInventory,
  buildReadiness = buildPolicyLibraryRebuildLegacyDeletionReadiness,
  buildFinalRemovalPlan = buildPolicyLibraryRebuildLegacyFinalRemovalPlan,
  buildGlobalGate = buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate,
} = {}) {
  async function evaluate({ now = new Date() } = {}) {
    const executionTime = normalizeExecutionTime(now);
    if (!executionTime || typeof dbClient?.withTransaction !== 'function' ||
        typeof loadEnabledPolicyInventory !== 'function' || typeof loadEvidence !== 'function' ||
        typeof buildRemovalInventory !== 'function' || typeof buildReadiness !== 'function' ||
        typeof buildFinalRemovalPlan !== 'function' || typeof buildGlobalGate !== 'function') {
      return buildBoundaryUnavailableResult({ now: executionTime || new Date() });
    }

    try {
      const gate = await dbClient.withTransaction(async client => {
        const policyInventory = await loadEnabledPolicyInventory({ client });
        const removalInventory = buildRemovalInventory();
        const finalRemovalPlans = [];

        // Rebuild each plan sequentially after the inventory lock. This keeps
        // shared policy locks in ascending order and avoids mixed cutover views.
        for (const policyContext of policyInventory) {
          const policyId = policyIdFromContext(policyContext);
          if (!policyId) continue;

          const evidence = await loadEvidence({ client, policyId });
          const readiness = buildReadiness({
            ...evidence,
            removalInventory,
            now: executionTime,
          });
          finalRemovalPlans.push(buildFinalRemovalPlan({
            readiness,
            removalInventory,
            now: executionTime,
          }));
        }

        return buildGlobalGate({
          policyInventory,
          finalRemovalPlans,
          removalInventory,
          now: executionTime,
        });
      });

      return addDatabaseRead(gate, true);
    } catch {
      return buildBoundaryUnavailableResult({ now: executionTime });
    }
  }

  return {
    evaluate,
  };
}

export {
  createPolicyLibraryRebuildLegacyGlobalReleaseRetirementGateService,
};
