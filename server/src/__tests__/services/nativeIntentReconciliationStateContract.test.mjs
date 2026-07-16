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
  NATIVE_INTENT_RECONCILIATION_REASON_IDS,
  buildNativeIntentReconciliationCandidatePlan,
  buildNativeIntentReconciliationStateOutcome,
  normalizeCandidate,
} from '../../services/nativeIntentReconciliationStateContract.mjs';
import {
  NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES,
} from '../../services/nativeIntentReconciliationLedgerContract.mjs';

function readyCandidate(policyId, overrides = {}) {
  return {
    policyId,
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
    ...overrides,
  };
}

describe('nativeIntentReconciliationStateContract', () => {
  test('records policy-local maintenance without letting it consume a ready conversion batch', () => {
    const plan = buildNativeIntentReconciliationCandidatePlan({
      candidates: [
        {
          policyId: 10,
          statusId: 'unsupported_legacy_shape',
          canConvert: false,
          reasonIds: ['unsupported_signal_type'],
        },
        readyCandidate(11),
      ],
      maxPolicies: 1,
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });

    expect(plan.selectedPolicyIds).toEqual([11]);
    expect(plan.stateUpserts).toEqual([expect.objectContaining({
      policyId: 10,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
      reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.UNSUPPORTED_LEGACY_SHAPE,
    })]);
    expect(plan.outcomeOverrides).toEqual([expect.objectContaining({
      policyId: 10,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
    })]);
  });

  test('honors a matching retry backoff but resets eligibility when the candidate fingerprint changes', () => {
    const candidate = readyCandidate(22);
    const normalized = normalizeCandidate(candidate);
    const persistedState = {
      policyId: 22,
      candidateFingerprint: normalized.candidateFingerprint,
      candidateStatusId: 'ready_to_convert',
      outcomeState: 'system_failure',
      reasonId: 'apply_failed_rolled_back',
      retryNotBefore: '2026-07-15T12:30:00.000Z',
      failureCount: 1,
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    };

    const deferredPlan = buildNativeIntentReconciliationCandidatePlan({
      candidates: [candidate],
      persistedStates: [persistedState],
      maxPolicies: 1,
      evaluatedAt: '2026-07-15T12:10:00.000Z',
    });
    const changedPlan = buildNativeIntentReconciliationCandidatePlan({
      candidates: [readyCandidate(22, { reasonIds: ['ready_to_convert', 'contract_repaired'] })],
      persistedStates: [persistedState],
      maxPolicies: 1,
      evaluatedAt: '2026-07-15T12:10:00.000Z',
    });

    expect(deferredPlan.selectedPolicyIds).toEqual([]);
    expect(deferredPlan.deferredPolicyIds).toEqual([22]);
    expect(changedPlan.selectedPolicyIds).toEqual([22]);
    expect(changedPlan.stateDeletes).toEqual([22]);
  });

  test('uses bounded fingerprint-stable retry timing and promotes repeated technical failures to maintenance', () => {
    const candidate = readyCandidate(30);
    const first = buildNativeIntentReconciliationStateOutcome({
      candidate,
      applyGate: { statusId: 'failed_rolled_back', failureCategory: 'transient_database' },
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });
    const second = buildNativeIntentReconciliationStateOutcome({
      candidate,
      previousState: first,
      applyGate: { statusId: 'failed_rolled_back', failureCategory: 'transient_database' },
      evaluatedAt: '2026-07-15T12:10:00.000Z',
    });
    const third = buildNativeIntentReconciliationStateOutcome({
      candidate,
      previousState: second,
      applyGate: { statusId: 'failed_rolled_back', failureCategory: 'transient_database' },
      evaluatedAt: '2026-07-15T12:30:00.000Z',
    });

    expect(first).toMatchObject({
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.SYSTEM_FAILURE,
      failureCount: 1,
    });
    expect(new Date(first.retryNotBefore).getTime()).toBeGreaterThan(
      new Date(first.evaluatedAt).getTime(),
    );
    expect(second).toMatchObject({ failureCount: 2 });
    expect(third).toEqual(expect.objectContaining({
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
      reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.TECHNICAL_RETRY_LIMIT_REACHED,
      failureCount: 3,
      retryNotBefore: null,
    }));

    const quarantinedPlan = buildNativeIntentReconciliationCandidatePlan({
      candidates: [candidate],
      persistedStates: [third],
      maxPolicies: 1,
      evaluatedAt: '2026-07-15T13:00:00.000Z',
    });

    expect(quarantinedPlan.selectedPolicyIds).toEqual([]);
    expect(quarantinedPlan.quarantinedPolicyIds).toEqual([30]);
    expect(quarantinedPlan.counts.quarantinedPolicyCount).toBe(1);
  });

  test('backs off an exhausted execution budget without consuming technical retry allowance', () => {
    const candidate = readyCandidate(31);
    const outcome = buildNativeIntentReconciliationStateOutcome({
      candidate,
      previousState: {
        policyId: 31,
        candidateFingerprint: normalizeCandidate(candidate).candidateFingerprint,
        candidateStatusId: 'ready_to_convert',
        outcomeState: 'system_failure',
        reasonId: 'transient_database',
        retryNotBefore: '2026-07-15T12:05:00.000Z',
        failureCount: 2,
        evaluatedAt: '2026-07-15T12:00:00.000Z',
      },
      applyGate: { statusId: 'deferred_by_execution_budget' },
      evaluatedAt: '2026-07-15T12:10:00.000Z',
    });

    expect(outcome).toEqual(expect.objectContaining({
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.DEFERRED_RETRY,
      reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.EXECUTION_BUDGET_EXHAUSTED,
      failureCount: 2,
    }));
    expect(outcome.retryNotBefore).not.toBeNull();
  });

  test('maps a required verifier failure to a non-writing current-state blocker', () => {
    const outcome = buildNativeIntentReconciliationStateOutcome({
      candidate: readyCandidate(41),
      applyGate: { statusId: 'blocked_by_no_ready_steps' },
      conversionStep: {
        policyId: 41,
        statusId: 'blocked_by_verifier',
        reasonIds: ['verifier_required'],
      },
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });

    expect(outcome).toEqual(expect.objectContaining({
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
      reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.REQUIRED_VERIFIER_FAILED,
      retryNotBefore: null,
    }));
  });

  test('records a final transactional rollback hold as a non-retryable current-state blocker', () => {
    const outcome = buildNativeIntentReconciliationStateOutcome({
      candidate: readyCandidate(42),
      applyGate: {
        statusId: 'applied',
        results: [{
          policyId: 42,
          skippedByReconciliationGuard: true,
          guardReasonId: 'rollback_reconciliation_hold',
        }],
      },
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });

    expect(outcome).toEqual(expect.objectContaining({
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
      reasonId: 'rollback_reconciliation_hold',
      retryNotBefore: null,
    }));
  });
});
