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
  validatePolicyLibraryRebuildLegacyDeletionReadiness,
} from './policyLibraryRebuildLegacyDeletionReadiness.mjs';
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

function addDatabaseRead(result, databaseRead) {
  const readiness = {
    ...result,
    sideEffects: {
      ...result.sideEffects,
      databaseRead,
    },
  };

  return {
    ...readiness,
    validation: validatePolicyLibraryRebuildLegacyDeletionReadiness(readiness),
  };
}

function buildBoundaryUnavailableResult({ policyId, now, removalInventory }) {
  return buildPolicyLibraryRebuildLegacyDeletionReadiness({
    policy: { id: policyId },
    removalInventory,
    evidenceBoundaryAvailable: false,
    now,
  });
}

function createPolicyLibraryRebuildLegacyDeletionReadinessService({
  dbClient = defaultDb,
  loadEvidence = loadPolicyLibraryRebuildLegacyDeletionEvidence,
  buildRemovalInventory = buildPolicyLibraryRebuildLegacyRemovalInventory,
} = {}) {
  async function evaluate({ policyId, now = new Date() } = {}) {
    const executionTime = normalizeExecutionTime(now);
    if (!executionTime || typeof dbClient?.withTransaction !== 'function' ||
        typeof loadEvidence !== 'function' || typeof buildRemovalInventory !== 'function') {
      return buildBoundaryUnavailableResult({
        policyId,
        now: executionTime || new Date(),
        removalInventory: null,
      });
    }

    let removalInventory;
    try {
      removalInventory = buildRemovalInventory();
    } catch {
      return buildBoundaryUnavailableResult({
        policyId,
        now: executionTime,
        removalInventory: null,
      });
    }

    try {
      const readiness = await dbClient.withTransaction(async client => {
        const evidence = await loadEvidence({ client, policyId });
        return buildPolicyLibraryRebuildLegacyDeletionReadiness({
          ...evidence,
          removalInventory,
          now: executionTime,
        });
      });

      return addDatabaseRead(readiness, true);
    } catch {
      return buildBoundaryUnavailableResult({
        policyId,
        now: executionTime,
        removalInventory,
      });
    }
  }

  return {
    evaluate,
  };
}

export {
  createPolicyLibraryRebuildLegacyDeletionReadinessService,
};
