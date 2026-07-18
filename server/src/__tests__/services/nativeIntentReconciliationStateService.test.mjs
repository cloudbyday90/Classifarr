/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import {
  NativeIntentReconciliationStateService,
} from '../../services/nativeIntentReconciliationStateService.mjs';
import {
  normalizeCandidate,
} from '../../services/nativeIntentReconciliationStateContract.mjs';

describe('NativeIntentReconciliationStateService', () => {
  test('plans from compact candidates and persists only stable state fields', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const db = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      withTransaction: jest.fn(async callback => callback(client)),
    };
    const upsertState = jest.fn().mockResolvedValue();
    const deleteStates = jest.fn().mockResolvedValue(0);
    const service = new NativeIntentReconciliationStateService({
      db,
      upsertState,
      deleteStates,
      loggerInstance: { info: jest.fn() },
    });

    const plan = await service.plan({
      candidates: [{
        policyId: 10,
        statusId: 'unsupported_legacy_shape',
        canConvert: false,
        reasonIds: ['unsupported_signal_type'],
        rawLegacyJson: { secret: 'must not persist' },
      }],
      maxPolicies: 10,
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });
    const result = await service.persist(plan);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM policy_native_intent_reconciliation_states'),
      [[10]],
    );
    expect(upsertState).toHaveBeenCalledWith(expect.objectContaining({
      client,
      state: expect.objectContaining({ policyId: 10 }),
    }));
    expect(JSON.stringify(upsertState.mock.calls)).not.toContain('must not persist');
    expect(result).toMatchObject({ statusId: 'persisted', upsertedCount: 1 });
  });

  test('uses the reconciliation run database for state reads and writes', async () => {
    const defaultDb = {
      query: jest.fn(),
      withTransaction: jest.fn(),
    };
    const runClient = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const runDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      withTransaction: jest.fn(async callback => callback(runClient)),
    };
    const service = new NativeIntentReconciliationStateService({
      db: defaultDb,
      upsertState: jest.fn().mockResolvedValue(),
      deleteStates: jest.fn().mockResolvedValue(0),
      loggerInstance: { info: jest.fn() },
    });

    await service.plan({
      candidates: [{
        policyId: 10,
        statusId: 'ready_to_convert',
        canConvert: true,
        reasonIds: ['ready_to_convert'],
      }],
      dbClient: runDb,
    });
    await service.persist({
      stateUpserts: [{ policyId: 10 }],
      dbClient: runDb,
    });

    expect(runDb.query).toHaveBeenCalled();
    expect(runDb.withTransaction).toHaveBeenCalled();
    expect(defaultDb.query).not.toHaveBeenCalled();
    expect(defaultDb.withTransaction).not.toHaveBeenCalled();
  });

  test('reports a state write skipped because a concurrent transition made native authority current', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const db = {
      withTransaction: jest.fn(async callback => callback(client)),
    };
    const service = new NativeIntentReconciliationStateService({
      db,
      upsertState: jest.fn().mockResolvedValue({
        statusId: 'skipped_authoritative',
        upsertedCount: 0,
        deletedCount: 0,
        rawPayloadExposed: false,
      }),
      deleteStates: jest.fn().mockResolvedValue(0),
      loggerInstance: { info: jest.fn() },
    });

    const result = await service.persist({
      stateUpserts: [{ policyId: 10 }],
      dbClient: db,
    });

    expect(result).toMatchObject({
      statusId: 'persisted',
      upsertedCount: 0,
      deletedCount: 0,
      skippedAuthoritativeCount: 1,
    });
  });

  test('honors a persisted retry backoff after a fresh service instance restarts', async () => {
    const candidate = {
      policyId: 12,
      statusId: 'ready_to_convert',
      canConvert: true,
      reasonIds: ['ready_to_convert'],
      intentContract: {
        schemaVersion: 1,
        source: 'legacy_inference',
        inferenceState: 'complete',
        valid: true,
        errorCount: 0,
        warningCount: 0,
        unsupportedSignalCount: 0,
      },
    };
    const retryState = {
      policy_id: 12,
      candidate_fingerprint: normalizeCandidate(candidate).candidateFingerprint,
      candidate_status_id: 'ready_to_convert',
      outcome_state: 'system_failure',
      reason_id: 'apply_failed_rolled_back',
      retry_not_before: '2026-07-16T12:10:00.000Z',
      failure_count: 1,
      evaluated_at: '2026-07-16T12:00:00.000Z',
    };
    const loadStates = jest.fn().mockResolvedValue([retryState]);
    const restartedDb = { query: jest.fn() };
    const restartedService = new NativeIntentReconciliationStateService({
      db: restartedDb,
      loadStates,
      loggerInstance: { info: jest.fn() },
    });

    const duringBackoff = await restartedService.plan({
      candidates: [candidate],
      maxPolicies: 1,
      evaluatedAt: '2026-07-16T12:05:00.000Z',
      dbClient: restartedDb,
    });
    const afterBackoff = await restartedService.plan({
      candidates: [candidate],
      maxPolicies: 1,
      evaluatedAt: '2026-07-16T12:11:00.000Z',
      dbClient: restartedDb,
    });

    expect(loadStates).toHaveBeenCalledTimes(2);
    expect(loadStates).toHaveBeenCalledWith(expect.objectContaining({
      policyIds: [12],
    }));
    expect(duringBackoff.selectedPolicyIds).toEqual([]);
    expect(duringBackoff.deferredPolicyIds).toEqual([12]);
    expect(afterBackoff.selectedPolicyIds).toEqual([12]);
    expect(afterBackoff.deferredPolicyIds).toEqual([]);
  });

  test('clears current retry state after an idempotent successful conversion', () => {
    const service = new NativeIntentReconciliationStateService({
      db: {},
      loggerInstance: { info: jest.fn() },
    });

    const resolution = service.resolveApplyOutcomes({
      selectedCandidates: [{
        policyId: 10,
        statusId: 'ready_to_convert',
        canConvert: true,
        reasonIds: ['ready_to_convert'],
      }],
      persistedStates: [{
        policyId: 10,
        candidate_fingerprint: `sha256:${'a'.repeat(64)}`,
        candidate_status_id: 'ready_to_convert',
        outcome_state: 'system_failure',
        reason_id: 'apply_failed_rolled_back',
        failure_count: 1,
        retry_not_before: '2026-07-15T12:30:00.000Z',
        evaluated_at: '2026-07-15T12:00:00.000Z',
      }],
      applyGate: {
        statusId: 'applied',
        results: [{ policyId: 10, alreadyConverted: false }],
      },
      evaluatedAt: '2026-07-15T12:10:00.000Z',
    });

    expect(resolution.stateDeletes).toEqual([10]);
    expect(resolution.stateUpserts).toEqual([]);
    expect(resolution.outcomeOverrides).toEqual([expect.objectContaining({
      policyId: 10,
      outcomeState: 'applied',
      reasonId: 'conversion_applied',
    })]);
  });
});
