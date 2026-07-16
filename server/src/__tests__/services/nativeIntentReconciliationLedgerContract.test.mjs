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
  NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES,
  NATIVE_INTENT_RECONCILIATION_RUN_STATES,
  buildNativeIntentReconciliationCandidateFingerprint,
  buildNativeIntentReconciliationLedgerRecord,
} from '../../services/nativeIntentReconciliationLedgerContract.mjs';

describe('nativeIntentReconciliationLedgerContract', () => {
  test('builds a deterministic fingerprint from bounded candidate state only', () => {
    const candidate = {
      policyId: 12,
      statusId: 'ready_to_convert',
      canConvert: true,
      reasonIds: ['ready_to_convert', 'intent_contract_valid'],
      intentContract: {
        schemaVersion: 1,
        source: 'legacy_inference',
        inferenceState: 'complete',
        valid: true,
        errorCount: 0,
        warningCount: 0,
        unsupportedSignalCount: 0,
      },
      rawLegacyJson: { customSignals: ['must never be fingerprint input'] },
      policyName: 'Sensitive library naming is irrelevant',
    };

    const fingerprint = buildNativeIntentReconciliationCandidateFingerprint(candidate);
    const changedRawOnly = buildNativeIntentReconciliationCandidateFingerprint({
      ...candidate,
      rawLegacyJson: { customSignals: ['different secret'] },
      policyName: 'Different title',
    });
    const changedState = buildNativeIntentReconciliationCandidateFingerprint({
      ...candidate,
      statusId: 'needs_operator_review',
    });

    expect(fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(changedRawOnly).toBe(fingerprint);
    expect(changedState).not.toBe(fingerprint);
  });

  test('records applied, already-native, and blocked outcomes without payload fields', () => {
    const record = buildNativeIntentReconciliationLedgerRecord({
      startedAt: '2026-07-15T12:00:00.000Z',
      finishedAt: '2026-07-15T12:00:04.000Z',
      runKey: 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c',
      applyGate: {
        statusId: 'applied',
        results: [
          { policyId: 10, alreadyConverted: false, rawSnapshot: { never: 'persisted' } },
          { policyId: 11, alreadyConverted: true },
        ],
        reconciliationCandidates: [
          {
            policyId: 10,
            statusId: 'ready_to_convert',
            canConvert: true,
            reasonIds: ['ready_to_convert'],
          },
          {
            policyId: 11,
            statusId: 'ready_to_convert',
            canConvert: true,
            reasonIds: ['ready_to_convert'],
          },
          {
            policyId: 12,
            statusId: 'unsupported_legacy_shape',
            canConvert: false,
            reasonIds: ['unsupported_signal_type'],
            customSignals: [{ value: 'must never escape' }],
          },
        ],
      },
    });

    expect(record.run).toMatchObject({
      runState: NATIVE_INTENT_RECONCILIATION_RUN_STATES.APPLIED,
      candidateCount: 3,
      convertedCount: 1,
      alreadyNativeCount: 1,
      blockedCount: 1,
    });
    expect(record.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({ policyId: 10, outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.APPLIED }),
      expect.objectContaining({ policyId: 11, outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.ALREADY_NATIVE }),
      expect.objectContaining({
        policyId: 12,
        outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
        reasonId: 'unsupported_signal_type',
      }),
    ]));
    expect(JSON.stringify(record)).not.toContain('must never');
  });

  test('marks an execution-budget interruption as deferred rather than complete', () => {
    const record = buildNativeIntentReconciliationLedgerRecord({
      startedAt: '2026-07-15T12:00:00.000Z',
      finishedAt: '2026-07-15T12:00:20.000Z',
      applyGate: {
        statusId: 'deferred_by_execution_budget',
        reconciliationCandidates: [{
          policyId: 10,
          statusId: 'ready_to_convert',
          canConvert: true,
          reasonIds: ['ready_to_convert'],
        }],
      },
    });

    expect(record.run).toMatchObject({
      runState: NATIVE_INTENT_RECONCILIATION_RUN_STATES.DEFERRED,
      reasonId: 'execution_budget_exhausted',
      deferredCount: 1,
    });
    expect(record.outcomes[0]).toMatchObject({
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.DEFERRED_RETRY,
      retryNotBefore: null,
    });
  });

  test('records an aborted execution as failed even when it has no candidate outcomes', () => {
    const record = buildNativeIntentReconciliationLedgerRecord({
      startedAt: '2026-07-15T12:00:00.000Z',
      finishedAt: '2026-07-15T12:00:01.000Z',
      applyGate: {
        statusId: 'failed',
        operatorErrorIds: ['reconciliation_candidate_input_load_failed'],
        reconciliationCandidates: [],
      },
    });

    expect(record.run).toMatchObject({
      runState: NATIVE_INTENT_RECONCILIATION_RUN_STATES.FAILED,
      sourceStatusId: 'failed',
      reasonId: 'reconciliation_candidate_input_load_failed',
      candidateCount: 0,
      failedCount: 0,
    });
    expect(record.outcomes).toEqual([]);
  });

  test('records an empty evaluated execution as no candidates', () => {
    const record = buildNativeIntentReconciliationLedgerRecord({
      startedAt: '2026-07-16T01:00:00.000Z',
      finishedAt: '2026-07-16T01:00:01.000Z',
      applyGate: {
        statusId: 'evaluated',
        reconciliationCandidates: [],
      },
    });

    expect(record.run).toMatchObject({
      runState: NATIVE_INTENT_RECONCILIATION_RUN_STATES.EVALUATED,
      sourceStatusId: 'evaluated',
      reasonId: 'no_candidates',
      candidateCount: 0,
      failedCount: 0,
    });
    expect(record.outcomes).toEqual([]);
  });

  test('uses a safe execution override for a terminal maintenance disposition', () => {
    const record = buildNativeIntentReconciliationLedgerRecord({
      applyGate: {
        statusId: 'evaluated',
        reconciliationCandidates: [{
          policyId: 10,
          statusId: 'unsupported_legacy_shape',
          canConvert: false,
          reasonIds: ['unsupported_signal_type'],
          rawLegacyJson: { token: 'must never escape' },
        }],
        reconciliationOutcomeOverrides: [{
          policyId: 10,
          outcomeState: 'requires_maintenance',
          reasonId: 'technical_retry_limit_reached',
          errorMessage: 'must never escape',
        }],
      },
    });

    expect(record.outcomes).toEqual([expect.objectContaining({
      policyId: 10,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
      reasonId: 'technical_retry_limit_reached',
      retryNotBefore: null,
    })]);
    expect(JSON.stringify(record)).not.toContain('must never escape');
  });

  test('uses a safe execution override for a terminal maintenance disposition', () => {
    const record = buildNativeIntentReconciliationLedgerRecord({
      applyGate: {
        statusId: 'evaluated',
        reconciliationCandidates: [{
          policyId: 10,
          statusId: 'unsupported_legacy_shape',
          canConvert: false,
          reasonIds: ['unsupported_signal_type'],
          rawLegacyJson: { token: 'must never escape' },
        }],
        reconciliationOutcomeOverrides: [{
          policyId: 10,
          outcomeState: 'requires_maintenance',
          reasonId: 'technical_retry_limit_reached',
          errorMessage: 'must never escape',
        }],
      },
    });

    expect(record.outcomes).toEqual([expect.objectContaining({
      policyId: 10,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
      reasonId: 'technical_retry_limit_reached',
      retryNotBefore: null,
    })]);
    expect(JSON.stringify(record)).not.toContain('must never escape');
  });

  test('never returns a finish timestamp before the run start time', () => {
    const record = buildNativeIntentReconciliationLedgerRecord({
      startedAt: '2026-07-15T12:00:20.000Z',
      finishedAt: '2026-07-15T12:00:00.000Z',
      applyGate: { statusId: 'evaluated' },
    });

    expect(record.run.startedAt).toBe('2026-07-15T12:00:20.000Z');
    expect(record.run.finishedAt).toBe(record.run.startedAt);
  });
});
