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
  validatePolicyLibraryRebuildLegacyFinalRemovalPlan,
} from './policyLibraryRebuildLegacyFinalRemovalPlan.mjs';
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

function addDatabaseRead(plan, databaseRead) {
  const result = {
    ...plan,
    sideEffects: {
      ...plan.sideEffects,
      databaseRead,
    },
  };

  return {
    ...result,
    validation: validatePolicyLibraryRebuildLegacyFinalRemovalPlan(result),
  };
}

function buildBoundaryUnavailableResult({ policyId, now, removalInventory = null }) {
  const readiness = buildPolicyLibraryRebuildLegacyDeletionReadiness({
    policy: { id: policyId },
    removalInventory,
    evidenceBoundaryAvailable: false,
    now,
  });

  return buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
    readiness,
    removalInventory,
    evidenceBoundaryAvailable: false,
    now,
  });
}

function createPolicyLibraryRebuildLegacyFinalRemovalAuditService({
  dbClient = defaultDb,
  loadEvidence = loadPolicyLibraryRebuildLegacyDeletionEvidence,
  buildRemovalInventory = buildPolicyLibraryRebuildLegacyRemovalInventory,
  buildReadiness = buildPolicyLibraryRebuildLegacyDeletionReadiness,
  buildFinalRemovalPlan = buildPolicyLibraryRebuildLegacyFinalRemovalPlan,
} = {}) {
  async function audit({ policyId, now = new Date() } = {}) {
    const executionTime = normalizeExecutionTime(now);
    if (!executionTime || typeof dbClient?.withTransaction !== 'function' ||
        typeof loadEvidence !== 'function' || typeof buildRemovalInventory !== 'function' ||
        typeof buildReadiness !== 'function' || typeof buildFinalRemovalPlan !== 'function') {
      return buildBoundaryUnavailableResult({
        policyId,
        now: executionTime || new Date(),
      });
    }

    try {
      const plan = await dbClient.withTransaction(async client => {
        const evidence = await loadEvidence({ client, policyId });
        const removalInventory = buildRemovalInventory();
        const readiness = buildReadiness({
          ...evidence,
          removalInventory,
          now: executionTime,
        });

        return buildFinalRemovalPlan({
          readiness,
          removalInventory,
          now: executionTime,
        });
      });

      return addDatabaseRead(plan, true);
    } catch {
      return buildBoundaryUnavailableResult({ policyId, now: executionTime });
    }
  }

  return {
    audit,
  };
}

export {
  createPolicyLibraryRebuildLegacyFinalRemovalAuditService,
};
