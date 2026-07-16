/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildNativeIntentReconciliationStatus,
  NATIVE_INTENT_RECONCILIATION_STATUS_IDS,
} from '../../services/nativeIntentReconciliationStatusContract.mjs';

const RUN_KEY = 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c';

function buildStatus(overrides = {}) {
  return buildNativeIntentReconciliationStatus({
    evaluatedAt: '2026-07-16T01:00:00.000Z',
    nextScheduledAttemptAt: '2026-07-16T01:10:00.000Z',
    control: {
      available: true,
      automationEnabled: true,
      circuitState: 'closed',
      recoveryRequirement: 'none',
    },
    latestRun: {
      run_key: RUN_KEY,
      run_state: 'evaluated',
      source_status_id: 'no_candidates',
      reason_id: 'no_candidates',
      finished_at: '2026-07-16T00:50:00.000Z',
      candidate_count: 0,
    },
    inventory: {},
    blockerReasonGroups: [],
    recentFailedRunCount: 0,
    ...overrides,
  });
}

describe('Native intent reconciliation status contract', () => {
  test('returns a bounded, read-only snapshot with a safe run correlation', () => {
    const status = buildStatus({
      inventory: {
        unresolved_count: 3,
        requires_maintenance_count: 1,
        oldest_unresolved_at: '2026-07-15T01:00:00.000Z',
      },
      blockerReasonGroups: [
        { outcome_state: 'requires_maintenance', reason_id: 'unsupported_legacy_shape', policy_count: 1 },
        { outcome_state: 'blocked_current_state', reason_id: 'operator_review_required', policy_count: 2 },
        { outcome_state: 'invalid state', reason_id: 'do_not_return', policy_count: 999 },
      ],
    });

    expect(status).toEqual(expect.objectContaining({
      statusId: NATIVE_INTENT_RECONCILIATION_STATUS_IDS.ATTENTION_REQUIRED,
      nextScheduledAttemptAt: '2026-07-16T01:10:00.000Z',
      rawPayloadExposed: false,
      latestRun: expect.objectContaining({ correlationId: RUN_KEY }),
      inventory: expect.objectContaining({ unresolvedCount: 3, requiresMaintenanceCount: 1 }),
    }));
    expect(status.blockerReasonGroups).toEqual([
      expect.objectContaining({ outcomeState: 'requires_maintenance', reasonId: 'unsupported_legacy_shape' }),
      expect.objectContaining({ outcomeState: 'blocked_current_state', reasonId: 'operator_review_required' }),
    ]);
    expect(JSON.stringify(status)).not.toContain('do_not_return');
  });

  test('reports an unavailable control and an open circuit without inventing a successful run', () => {
    const unavailable = buildStatus({
      control: { available: false },
      latestRun: { run_key: 'not-a-uuid' },
    });
    const open = buildStatus({
      control: {
        available: true,
        automationEnabled: true,
        circuitState: 'open',
        recoveryRequirement: 'healthy_evaluation',
      },
    });

    expect(unavailable.statusId).toBe(NATIVE_INTENT_RECONCILIATION_STATUS_IDS.CONTROL_UNAVAILABLE);
    expect(unavailable.latestRun).toBeNull();
    expect(open.statusId).toBe(NATIVE_INTENT_RECONCILIATION_STATUS_IDS.CIRCUIT_OPEN);
  });
});
