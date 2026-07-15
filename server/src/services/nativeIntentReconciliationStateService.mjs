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
import { createLogger } from '../utils/logger.mjs';
import {
  buildNativeIntentReconciliationCandidatePlan,
  buildNativeIntentReconciliationStateOutcome,
  normalizeCandidate,
  normalizePersistedState,
} from './nativeIntentReconciliationStateContract.mjs';
import {
  deleteNativeIntentReconciliationStates,
  loadNativeIntentReconciliationStates,
  upsertNativeIntentReconciliationState,
} from './nativeIntentReconciliationStatePersistence.mjs';

const logger = createLogger('NativeIntentReconciliationStateService');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function safeConversionSteps(value) {
  return asArray(value)
    .map(step => {
      const policyId = Number(step?.policyId);
      if (!Number.isInteger(policyId) || policyId <= 0) return null;

      return {
        policyId,
        statusId: typeof step.statusId === 'string' ? step.statusId : null,
        reasonIds: asArray(step.reasons)
          .map(reason => reason?.reasonId)
          .filter(reasonId => typeof reasonId === 'string'),
      };
    })
    .filter(Boolean);
}

function buildStateMap(states = []) {
  return new Map(asArray(states)
    .map(normalizePersistedState)
    .filter(Boolean)
    .map(state => [state.policyId, state]));
}

function buildPersistedOutcome({ outcome, existingState }) {
  if (!outcome || outcome.clearState === true) return null;

  return {
    policyId: outcome.policyId,
    candidateFingerprint: outcome.candidateFingerprint,
    candidateStatusId: outcome.candidateStatusId,
    outcomeState: outcome.outcomeState,
    reasonId: outcome.reasonId,
    retryNotBefore: outcome.retryNotBefore,
    failureCount: outcome.failureCount,
    evaluatedAt: outcome.evaluatedAt,
    previousState: existingState || null,
  };
}

export class NativeIntentReconciliationStateService {
  constructor({
    db = defaultDb,
    loggerInstance = logger,
    now = () => new Date(),
    loadStates = loadNativeIntentReconciliationStates,
    buildPlan = buildNativeIntentReconciliationCandidatePlan,
    buildOutcome = buildNativeIntentReconciliationStateOutcome,
    upsertState = upsertNativeIntentReconciliationState,
    deleteStates = deleteNativeIntentReconciliationStates,
  } = {}) {
    this.db = db;
    this.logger = loggerInstance;
    this.now = now;
    this.loadStates = loadStates;
    this.buildPlan = buildPlan;
    this.buildOutcome = buildOutcome;
    this.upsertState = upsertState;
    this.deleteStates = deleteStates;
  }

  async plan({ candidates = [], maxPolicies, evaluatedAt = this.now(), dbClient = this.db } = {}) {
    if (typeof dbClient?.query !== 'function') {
      throw new TypeError('Native intent reconciliation state requires database query access.');
    }

    const normalizedCandidates = asArray(candidates)
      .map(normalizeCandidate)
      .filter(Boolean);
    const persistedStates = await this.loadStates({
      db: dbClient,
      policyIds: normalizedCandidates.map(candidate => candidate.policyId),
    });

    const plan = this.buildPlan({
      candidates: normalizedCandidates,
      persistedStates,
      maxPolicies,
      evaluatedAt,
    });

    return {
      ...plan,
      persistedStates: asArray(persistedStates).map(normalizePersistedState).filter(Boolean),
    };
  }

  async persist({ stateUpserts = [], stateDeletes = [], dbClient = this.db } = {}) {
    if (typeof dbClient?.withTransaction !== 'function') {
      throw new TypeError('Native intent reconciliation state requires a transaction boundary.');
    }

    const upserts = asArray(stateUpserts).filter(Boolean);
    const deletes = [...new Set(asArray(stateDeletes)
      .map(policyId => Number(policyId))
      .filter(policyId => Number.isInteger(policyId) && policyId > 0))];
    if (upserts.length === 0 && deletes.length === 0) {
      return {
        statusId: 'unchanged',
        upsertedCount: 0,
        deletedCount: 0,
        rawPayloadExposed: false,
      };
    }

    const result = await dbClient.withTransaction(async client => {
      for (const state of upserts) {
        await this.upsertState({ client, state });
      }
      const deletedCount = await this.deleteStates({ client, policyIds: deletes });
      return { deletedCount };
    });

    return {
      statusId: 'persisted',
      upsertedCount: upserts.length,
      deletedCount: result.deletedCount,
      rawPayloadExposed: false,
    };
  }

  resolveApplyOutcomes({
    applyGate = {},
    selectedCandidates = [],
    persistedStates = [],
    conversionSteps = [],
    evaluatedAt = this.now(),
  } = {}) {
    const stateByPolicyId = buildStateMap(persistedStates);
    const stepsByPolicyId = new Map(safeConversionSteps(conversionSteps)
      .map(step => [step.policyId, step]));
    const outcomes = asArray(selectedCandidates)
      .map(candidate => this.buildOutcome({
        candidate,
        previousState: stateByPolicyId.get(candidate.policyId) || null,
        applyGate,
        conversionStep: stepsByPolicyId.get(candidate.policyId) || null,
        evaluatedAt,
      }))
      .filter(Boolean);
    const stateUpserts = outcomes
      .map(outcome => buildPersistedOutcome({
        outcome,
        existingState: stateByPolicyId.get(outcome.policyId),
      }))
      .filter(Boolean);
    const stateDeletes = outcomes
      .filter(outcome => outcome.clearState === true)
      .map(outcome => outcome.policyId);

    return {
      evaluatedAt: normalizeTimestamp(evaluatedAt),
      outcomes,
      stateUpserts,
      stateDeletes,
      outcomeOverrides: outcomes.map(outcome => ({
        policyId: outcome.policyId,
        outcomeState: outcome.outcomeState,
        reasonId: outcome.reasonId,
        retryNotBefore: outcome.retryNotBefore,
      })),
    };
  }

  async persistApplyOutcomes(input = {}) {
    const resolution = this.resolveApplyOutcomes(input);
    const persistence = await this.persist({
      ...resolution,
      dbClient: input.dbClient,
    });

    this.logger.info('Native intent reconciliation state resolved', {
      statusId: persistence.statusId,
      upsertedCount: persistence.upsertedCount,
      deletedCount: persistence.deletedCount,
      outcomeCount: resolution.outcomes.length,
    });

    return {
      ...resolution,
      persistence,
    };
  }
}

export const nativeIntentReconciliationStateService =
  new NativeIntentReconciliationStateService();
