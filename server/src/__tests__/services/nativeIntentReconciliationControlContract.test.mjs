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
  NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS,
  NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS,
  NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS,
  buildSystemFailureTransition,
  classifyApplyGateSystemFailure,
  classifyErrorFailureCategory,
  normalizeControl,
} from '../../services/nativeIntentReconciliationControlContract.mjs';

function closedControl(overrides = {}) {
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

describe('nativeIntentReconciliationControlContract', () => {
  test('opens only after repeated failures of the same systemic category in the window', () => {
    const first = buildSystemFailureTransition({
      control: closedControl(),
      failureCategory: 'transient_database',
      now: '2026-07-15T12:00:00.000Z',
    });
    const second = buildSystemFailureTransition({
      control: first.control,
      failureCategory: 'transient_database',
      now: '2026-07-15T12:05:00.000Z',
    });
    const third = buildSystemFailureTransition({
      control: second.control,
      failureCategory: 'transient_database',
      now: '2026-07-15T12:10:00.000Z',
    });

    expect(first.opened).toBe(false);
    expect(second.opened).toBe(false);
    expect(third).toEqual(expect.objectContaining({
      opened: true,
      failureCategory: NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS.TRANSIENT_DATABASE,
      control: expect.objectContaining({
        circuitState: NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.OPEN,
        recoveryRequirement:
          NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.HEALTHY_EVALUATION,
        failureCount: 3,
      }),
    }));
  });

  test('requires an administrator reset for repeated schema or authority integrity failures', () => {
    const first = buildSystemFailureTransition({
      control: closedControl(),
      failureCategory: 'schema_incompatible',
      now: '2026-07-15T12:00:00.000Z',
    });
    const second = buildSystemFailureTransition({
      control: first.control,
      failureCategory: 'schema_incompatible',
      now: '2026-07-15T12:01:00.000Z',
    });
    const third = buildSystemFailureTransition({
      control: second.control,
      failureCategory: 'schema_incompatible',
      now: '2026-07-15T12:02:00.000Z',
    });

    expect(third.control.recoveryRequirement).toBe(
      NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.ADMIN_RESET,
    );
  });

  test('does not elevate a policy-local conversion failure into a systemic circuit failure', () => {
    expect(classifyApplyGateSystemFailure({
      statusId: 'failed_rolled_back',
      failureCategory: 'apply_failed_rolled_back',
      operatorErrorIds: ['policy_authority_unavailable'],
    })).toBeNull();
  });

  test('classifies only bounded database and schema error codes from a thrown error', () => {
    expect(classifyErrorFailureCategory({ code: 'ECONNREFUSED' })).toBe('transient_database');
    expect(classifyErrorFailureCategory({ code: '42P01' })).toBe('schema_incompatible');
    expect(classifyErrorFailureCategory({ message: 'database password must not escape' })).toBeNull();
  });

  test('fails closed when the persisted control row is absent', () => {
    expect(normalizeControl(null)).toEqual(expect.objectContaining({
      available: false,
      automationEnabled: false,
      circuitState: NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.OPEN,
      rawPayloadExposed: false,
    }));
  });
});
