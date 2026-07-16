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
  NativeIntentReconciliationLifecycleService,
} from '../../services/nativeIntentReconciliationLifecycleService.mjs';

function createService(overrides = {}) {
  return new NativeIntentReconciliationLifecycleService({
    db: {},
    now: () => '2026-07-15T15:00:00.000Z',
    createRestoreToken: () => '7e6e10c0-559b-4456-a655-bdacb8b3a0f1',
    loadRestoreGate: jest.fn().mockResolvedValue({
      gate_state: 'ready',
      reason_id: 'restore_verified',
    }),
    beginRestore: jest.fn().mockResolvedValue({ gate_state: 'restore_in_progress' }),
    completeRestore: jest.fn().mockResolvedValue({
      gate_state: 'ready',
      reason_id: 'restore_verified',
    }),
    failRestore: jest.fn().mockResolvedValue({
      gate_state: 'requires_maintenance',
    }),
    loadHolds: jest.fn().mockResolvedValue([]),
    lockHold: jest.fn().mockResolvedValue(null),
    insertHold: jest.fn().mockResolvedValue(44),
    lockReentryPolicy: jest.fn().mockResolvedValue({ id: 44, has_active_native_intent: false }),
    insertReentryEvent: jest.fn().mockResolvedValue(912),
    releaseHold: jest.fn().mockResolvedValue(44),
    verifySchema: jest.fn().mockResolvedValue([
      { table_name: 'library_policies', present: true },
      { table_name: 'policy_intents', present: true },
      { table_name: 'policy_intent_migration_events', present: true },
      { table_name: 'policy_native_intent_reconciliation_states', present: true },
      { table_name: 'policy_native_intent_reconciliation_holds', present: true },
      { table_name: 'policy_native_intent_reconciliation_restore_gates', present: true },
    ]),
    countPolicyLibraryMismatches: jest.fn().mockResolvedValue(0),
    loadAuthorityIntegrity: jest.fn().mockResolvedValue({ statusId: 'clean' }),
    ...overrides,
  });
}

describe('NativeIntentReconciliationLifecycleService', () => {
  test('fails closed when the required singleton restore gate is absent', async () => {
    const service = createService({ loadRestoreGate: jest.fn().mockResolvedValue(null) });

    const result = await service.getExecutionEligibility({ dbClient: {} });

    expect(result).toEqual(expect.objectContaining({
      allowed: false,
      gateState: 'requires_maintenance',
      reasonId: 'restore_validation_failed',
      rawPayloadExposed: false,
    }));
  });

  test('removes held policies from reconciliation selection and emits a terminal ledger override', async () => {
    const loadHolds = jest.fn().mockResolvedValue([
      { policy_id: 44, source_event_id: 901, reason_id: 'rollback_applied' },
    ]);
    const service = createService({ loadHolds });

    const result = await service.partitionCandidates({
      dbClient: {},
      candidates: [{ policyId: 44 }, { policyId: 45 }],
    });

    expect(loadHolds).toHaveBeenCalledWith({ db: {}, policyIds: [44, 45] });
    expect(result.eligibleCandidates).toEqual([{ policyId: 45 }]);
    expect(result.heldCandidates).toEqual([expect.objectContaining({
      policyId: 44,
      hold: { sourceEventId: 901, reasonId: 'rollback_applied' },
    })]);
    expect(result.outcomeOverrides).toEqual([{
      policyId: 44,
      outcomeState: 'blocked_current_state',
      reasonId: 'rollback_reconciliation_hold',
      retryNotBefore: null,
    }]);
  });

  test('rechecks the global gate and policy hold inside the write transaction', async () => {
    const lockHold = jest.fn().mockResolvedValue({ policy_id: 44 });
    const service = createService({ lockHold });

    const result = await service.assertPolicyWriteEligible({ client: {}, policyId: 44 });

    expect(result).toEqual({ allowed: false, reasonId: 'rollback_reconciliation_hold' });
    expect(lockHold).toHaveBeenCalledWith({ client: {}, policyId: 44 });
  });

  test('records a rollback hold with the source migration event in the active transaction', async () => {
    const insertHold = jest.fn().mockResolvedValue(44);
    const service = createService({ insertHold });

    const result = await service.recordReversionHold({
      client: {},
      policyId: 44,
      sourceEventId: 901,
      heldAt: '2026-07-15T14:00:00.000Z',
    });

    expect(insertHold).toHaveBeenCalledWith({
      client: {},
      policyId: 44,
      sourceEventId: 901,
      reasonId: 'rollback_applied',
      heldAt: '2026-07-15T14:00:00.000Z',
    });
    expect(result).toEqual(expect.objectContaining({
      policyId: 44,
      reasonId: 'rollback_reconciliation_hold',
      rawPayloadExposed: false,
    }));
  });

  test('fails restore verification when schema parity or authority integrity is not clean', async () => {
    const service = createService({
      verifySchema: jest.fn().mockResolvedValue([{ table_name: 'library_policies', present: false }]),
      countPolicyLibraryMismatches: jest.fn().mockResolvedValue(1),
      loadAuthorityIntegrity: jest.fn().mockResolvedValue({ statusId: 'multiple_active_intents' }),
    });

    const result = await service.verifyRestoredDatabase({ dbClient: {} });

    expect(result).toEqual(expect.objectContaining({
      verified: false,
      schemaStatusId: 'schema_parity_missing',
      authorityStatusId: 'native_authority_integrity_failed',
      reasonId: 'restore_schema_parity_failed',
    }));
  });

  test('releases a hold only through an attributable transaction after native authority is absent', async () => {
    const client = {};
    const dbClient = { withTransaction: jest.fn(async work => work(client)) };
    const service = createService({
      lockHold: jest.fn().mockResolvedValue({ source_event_id: 901 }),
    });

    const result = await service.approvePolicyReentry({
      dbClient,
      policyId: 44,
      action: {
        actorSourceId: 'manual_operator',
        actorId: 7,
        reasonCode: 'operator_reviewed',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      approved: true,
      policyId: 44,
      reasonId: 'reconciliation_reentry_approved',
    }));
    expect(service.insertReentryEvent).toHaveBeenCalledWith(expect.objectContaining({
      client,
      policyId: 44,
      actorType: 'operator',
      actorId: 7,
      heldEventId: 901,
    }));
    expect(service.releaseHold).toHaveBeenCalledWith(expect.objectContaining({
      client,
      policyId: 44,
      releaseEventId: 912,
      releaseReasonId: 'approved_reentry',
    }));
  });
});
