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
    const service = new NativeIntentReconciliationExecutionService({
      dbClient: {},
      stateService,
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
      excludeRevertedPolicies: true,
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
      quarantinedPolicyCount: 1,
      rawPayloadExposed: false,
    }));
    expect(JSON.stringify(result)).not.toContain('must not escape');
  });
});
