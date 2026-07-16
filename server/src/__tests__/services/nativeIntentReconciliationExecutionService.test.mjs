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
  NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
  NativeIntentReconciliationExecutionService,
} from '../../services/nativeIntentReconciliationExecutionService.mjs';

describe('NativeIntentReconciliationExecutionService', () => {
  test('stops before candidate discovery when a restore gate is not ready', async () => {
    const lifecycleService = {
      getExecutionEligibility: jest.fn().mockResolvedValue({
        allowed: false,
        gateState: 'restore_in_progress',
        reasonId: 'restore_in_progress',
      }),
    };
    const loadCandidateInputs = jest.fn();
    const service = new NativeIntentReconciliationExecutionService({
      dbClient: {},
      lifecycleService,
      loadCandidateInputs,
      loggerInstance: { error: jest.fn() },
    });

    const result = await service.run({ dbClient: {} });

    expect(loadCandidateInputs).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      statusId: 'deferred_by_reconciliation_lifecycle_guard',
      reconciliationLifecycle: expect.objectContaining({
        gateState: 'restore_in_progress',
      }),
      reconciliationSelection: expect.objectContaining({
        discoveredPolicyCount: 0,
        heldPolicyCount: 0,
      }),
    }));
  });

  test('attributes candidate loading failures without exposing source error details', async () => {
    const sourceFailure = new Error('postgres://operator:password@internal must not escape');
    sourceFailure.code = '42P01';
    const service = new NativeIntentReconciliationExecutionService({
      dbClient: {},
      lifecycleService: {
        getExecutionEligibility: jest.fn().mockResolvedValue({ allowed: true }),
      },
      loadCandidateInputs: jest.fn().mockRejectedValue(sourceFailure),
      loggerInstance: { error: jest.fn() },
    });

    await expect(service.run({ dbClient: {} })).rejects.toMatchObject({
      name: 'NativeIntentReconciliationExecutionStageError',
      code: '42P01',
      nativeIntentReconciliationFailureStageId: 'candidate_input_load',
    });

    try {
      await service.run({ dbClient: {} });
    } catch (error) {
      expect(error.message).toBe('Native intent reconciliation execution stage failed');
      expect(error.message).not.toContain('password');
    }
  });

  test('scans a bounded window, selects only due candidates, and keeps compact ledger input', async () => {
    const selectedCandidate = {
      policyId: 11,
      statusId: 'ready_to_convert',
      canConvert: true,
      reasonIds: ['ready_to_convert'],
    };
    const stateService = {
      plan: jest.fn().mockResolvedValue({
        selectedCandidates: [selectedCandidate],
        selectedPolicyIds: [11],
        ledgerCandidates: [selectedCandidate],
        outcomeOverrides: [],
        stateUpserts: [],
        stateDeletes: [],
        persistedStates: [],
        deferredPolicyIds: [10],
        counts: {
          selectedPolicyCount: 1,
          deferredPolicyCount: 1,
          quarantinedPolicyCount: 1,
        },
      }),
      persist: jest.fn().mockResolvedValue({ statusId: 'persisted' }),
      resolveApplyOutcomes: jest.fn().mockReturnValue({
        outcomes: [],
        outcomeOverrides: [],
        stateUpserts: [],
        stateDeletes: [],
      }),
    };
    const loadCandidateInputs = jest.fn().mockResolvedValue({
      policies: [{ id: 11, rawLegacyJson: { value: 'must not escape' } }],
      activeIntentIntegrityReport: {},
    });
    const buildCandidateReport = jest.fn().mockReturnValue({
      candidates: [{
        policyId: 11,
        statusId: 'ready_to_convert',
        canConvert: true,
        reasons: [{ reasonId: 'ready_to_convert' }],
        intentContract: { valid: true },
      }],
    });
    const buildDryRun = jest.fn().mockReturnValue({
      conversionWorkflow: {
        steps: [{ policyId: 11, statusId: 'ready_to_apply', reasons: [] }],
      },
    });
    const applyGate = jest.fn().mockResolvedValue({
      statusId: 'applied',
      results: [{ policyId: 11, alreadyConverted: false }],
    });
    const lifecycleService = {
      getExecutionEligibility: jest.fn().mockResolvedValue({
        allowed: true,
        gateState: 'ready',
        reasonId: 'restore_verified',
      }),
      partitionCandidates: jest.fn().mockResolvedValue({
        eligibleCandidates: [selectedCandidate],
        heldCandidates: [],
        outcomeOverrides: [],
      }),
      assertPolicyWriteEligible: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const service = new NativeIntentReconciliationExecutionService({
      dbClient: {},
      stateService,
      lifecycleService,
      loggerInstance: { error: jest.fn() },
      loadCandidateInputs,
      buildCandidateReport,
      buildDryRun,
      applyGate,
    });

    const result = await service.run({
      dbClient: { withTransaction: jest.fn() },
      maxPolicies: 10,
      now: '2026-07-15T12:00:00.000Z',
      action: { actorSourceId: 'native_intent_reconciliation' },
    });

    expect(loadCandidateInputs).toHaveBeenCalledWith(expect.objectContaining({
      maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
      unconvertedOnly: true,
      excludeRevertedPolicies: false,
      prioritizeReconciliationEligibility: true,
    }));
    expect(stateService.plan).toHaveBeenCalledWith(expect.objectContaining({
      dbClient: expect.any(Object),
    }));
    expect(stateService.persist).toHaveBeenCalledWith(expect.objectContaining({
      dbClient: expect.any(Object),
    }));
    expect(buildDryRun).toHaveBeenCalledWith(expect.objectContaining({
      selectedPolicyIds: [11],
      candidateReport: expect.any(Object),
    }));
    expect(stateService.persist).toHaveBeenCalledTimes(2);
    expect(result.reconciliationCandidates).toEqual([selectedCandidate]);
    expect(result.reconciliationSelection).toEqual(expect.objectContaining({
      selectedPolicyCount: 1,
      deferredPolicyCount: 1,
      heldPolicyCount: 0,
      quarantinedPolicyCount: 1,
      rawPayloadExposed: false,
    }));
    expect(JSON.stringify(result)).not.toContain('must not escape');
  });

  test('keeps a held policy out of planning and passes a final write guard to apply', async () => {
    const heldCandidate = { policyId: 11, statusId: 'ready_to_convert', canConvert: true };
    const eligibleCandidate = { policyId: 12, statusId: 'ready_to_convert', canConvert: true };
    const lifecycleService = {
      getExecutionEligibility: jest.fn().mockResolvedValue({ allowed: true, gateState: 'ready' }),
      partitionCandidates: jest.fn().mockResolvedValue({
        eligibleCandidates: [eligibleCandidate],
        heldCandidates: [heldCandidate],
        outcomeOverrides: [{
          policyId: 11,
          outcomeState: 'blocked_current_state',
          reasonId: 'rollback_reconciliation_hold',
          retryNotBefore: null,
        }],
      }),
      assertPolicyWriteEligible: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const stateService = {
      plan: jest.fn().mockResolvedValue({
        selectedCandidates: [eligibleCandidate],
        selectedPolicyIds: [12],
        ledgerCandidates: [eligibleCandidate],
        outcomeOverrides: [],
        persistedStates: [],
        counts: { selectedPolicyCount: 1, deferredPolicyCount: 0, quarantinedPolicyCount: 0 },
      }),
      persist: jest.fn().mockResolvedValue({ statusId: 'persisted' }),
      resolveApplyOutcomes: jest.fn().mockReturnValue({
        outcomeOverrides: [],
        stateUpserts: [],
        stateDeletes: [],
      }),
    };
    const applyGate = jest.fn().mockResolvedValue({ statusId: 'applied', results: [] });
    const service = new NativeIntentReconciliationExecutionService({
      dbClient: {},
      lifecycleService,
      stateService,
      loggerInstance: { error: jest.fn() },
      loadCandidateInputs: jest.fn().mockResolvedValue({
        policies: [{ id: 11 }, { id: 12 }],
        activeIntentIntegrityReport: {},
      }),
      buildCandidateReport: jest.fn().mockReturnValue({
        candidates: [{ policyId: 11 }, { policyId: 12 }],
      }),
      buildDryRun: jest.fn().mockReturnValue({ conversionWorkflow: { steps: [] } }),
      applyGate,
    });

    const result = await service.run({
      dbClient: { withTransaction: jest.fn() },
      now: '2026-07-15T15:00:00.000Z',
    });

    expect(stateService.plan).toHaveBeenCalledWith(expect.objectContaining({
      candidates: [eligibleCandidate],
    }));
    expect(applyGate).toHaveBeenCalledWith(expect.objectContaining({
      policyWriteGuard: expect.any(Function),
    }));
    expect(result.reconciliationCandidates.map(candidate => candidate.policyId)).toEqual([11, 12]);
    expect(result.reconciliationSelection).toEqual(expect.objectContaining({ heldPolicyCount: 1 }));
  });
});
