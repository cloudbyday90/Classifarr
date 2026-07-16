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
  NativeIntentReconciliationControlService,
} from '../../services/nativeIntentReconciliationControlService.mjs';

function createControlRow(overrides = {}) {
  return {
    automation_enabled: true,
    circuit_state: 'closed',
    recovery_requirement: 'none',
    failure_count: 0,
    failure_window_started_at: null,
    last_failure_category: null,
    opened_at: null,
    recovery_probe_started_at: null,
    recovered_at: null,
    manual_disabled_at: null,
    manual_disabled_reason_id: null,
    ...overrides,
  };
}

function createService({ initialControl = createControlRow(), runRecoveryProbe } = {}) {
  let currentControl = initialControl;
  const client = { query: jest.fn() };
  const db = {
    query: jest.fn(),
    withTransaction: jest.fn(async work => work(client)),
  };
  const loadControl = jest.fn(async () => currentControl);
  const lockControl = jest.fn(async () => currentControl);
  const persistControl = jest.fn(async ({ control }) => {
    currentControl = control;
    return currentControl;
  });
  const insertEvent = jest.fn(async () => 1);
  const service = new NativeIntentReconciliationControlService({
    db,
    now: () => '2026-07-15T12:00:00.000Z',
    lifecycleService: {
      getExecutionEligibility: jest.fn().mockResolvedValue({ allowed: true }),
    },
    loadControl,
    lockControl,
    persistControl,
    insertEvent,
    runRecoveryProbe: runRecoveryProbe || jest.fn().mockResolvedValue({ healthy: true }),
    loggerInstance: { warn: jest.fn() },
  });

  return {
    service,
    db,
    insertEvent,
    persistControl,
    getControl: () => currentControl,
  };
}

describe('NativeIntentReconciliationControlService', () => {
  test('opens after three same-category systemic failures and blocks the next conversion run', async () => {
    const { service, db, getControl } = createService();

    await service.recordSystemFailure({ dbClient: db, failureCategory: 'transient_database' });
    await service.recordSystemFailure({ dbClient: db, failureCategory: 'transient_database' });
    const transition = await service.recordSystemFailure({
      dbClient: db,
      failureCategory: 'transient_database',
    });

    expect(transition.opened).toBe(true);
    expect(getControl()).toEqual(expect.objectContaining({
      circuitState: 'open',
      recoveryRequirement: 'healthy_evaluation',
      failureCount: 3,
    }));

    const eligibility = await service.getExecutionEligibility({ dbClient: db });

    expect(eligibility).toEqual(expect.objectContaining({
      allowed: false,
      statusId: 'deferred_after_reconciliation_recovery_probe',
      control: expect.objectContaining({ circuitState: 'closed' }),
    }));
  });

  test('requires reset before probing a circuit opened by a schema failure', async () => {
    const { service, db, getControl } = createService();

    for (let index = 0; index < 3; index += 1) {
      await service.recordSystemFailure({ dbClient: db, failureCategory: 'schema_incompatible' });
    }

    const blocked = await service.getExecutionEligibility({ dbClient: db });
    expect(blocked).toEqual(expect.objectContaining({
      allowed: false,
      statusId: 'deferred_by_reconciliation_circuit_breaker',
      control: expect.objectContaining({ recoveryRequirement: 'admin_reset' }),
    }));

    const reset = await service.resetCircuit({
      dbClient: db,
      action: { actorId: 7, reasonCode: 'schema_repaired' },
    });
    expect(reset.changed).toBe(true);
    expect(getControl()).toEqual(expect.objectContaining({
      circuitState: 'open',
      recoveryRequirement: 'healthy_evaluation',
    }));
  });

  test('permits only one recovery probe claim until the current probe becomes stale', async () => {
    const { service, db, getControl } = createService({
      initialControl: createControlRow({
        circuit_state: 'open',
        recovery_requirement: 'healthy_evaluation',
        failure_count: 3,
        failure_window_started_at: '2026-07-15T11:50:00.000Z',
        last_failure_category: 'transient_database',
        opened_at: '2026-07-15T11:55:00.000Z',
      }),
    });

    const firstClaim = await service.claimRecoveryProbe({
      dbClient: db,
      now: '2026-07-15T12:00:00.000Z',
    });
    const secondClaim = await service.claimRecoveryProbe({
      dbClient: db,
      now: '2026-07-15T12:00:01.000Z',
    });

    expect(firstClaim).toEqual(expect.objectContaining({
      claimed: true,
      control: expect.objectContaining({ circuitState: 'half_open' }),
    }));
    expect(secondClaim).toEqual(expect.objectContaining({
      claimed: false,
      control: expect.objectContaining({ circuitState: 'half_open' }),
    }));
    expect(getControl()).toEqual(expect.objectContaining({
      circuitState: 'half_open',
      recoveryProbeStartedAt: '2026-07-15T12:00:00.000Z',
    }));
  });

  test('does not change global control for policy-local conversion blockers', async () => {
    const { service, db, persistControl } = createService();

    const result = await service.recordExecutionResult({
      dbClient: db,
      applyGate: {
        statusId: 'failed_rolled_back',
        failureCategory: 'apply_failed_rolled_back',
      },
    });

    expect(result.changed).toBe(false);
    expect(persistControl).not.toHaveBeenCalled();
  });

  test('emergency stop is attributable and prevents an automatic run before discovery', async () => {
    const { service, db, insertEvent } = createService();

    const stopped = await service.disableAutomation({
      dbClient: db,
      action: { actorId: 7, reasonCode: 'operator_incident' },
    });
    expect(stopped).toEqual(expect.objectContaining({
      changed: true,
      control: expect.objectContaining({ automationEnabled: false }),
    }));
    expect(insertEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'automation_disabled',
      actorType: 'operator',
      actorId: 7,
    }));

    const eligibility = await service.getExecutionEligibility({ dbClient: db });
    expect(eligibility).toEqual(expect.objectContaining({
      allowed: false,
      statusId: 'deferred_by_reconciliation_emergency_stop',
      rawPayloadExposed: false,
    }));
  });
});
