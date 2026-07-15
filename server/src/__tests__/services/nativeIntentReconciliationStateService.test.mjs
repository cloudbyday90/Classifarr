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
