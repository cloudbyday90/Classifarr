/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createCandidateBoundVerificationRemediationReadinessService,
} from '../services/classificationCandidateBoundVerificationRemediationReadinessService.mjs';

describe('classificationCandidateBoundVerificationRemediationReadinessService', () => {
  test('composes metrics and current anonymous readiness inputs without a provider call', async () => {
    const database = { query: jest.fn() };
    const getSummary = jest.fn().mockResolvedValue({
      current: { totalOutcomes: 4 },
      driftGuard: { statusId: 'stable' },
    });
    const loadProviderConfiguration = jest.fn().mockResolvedValue({
      primary_provider: 'openai',
      model: 'gpt-4o',
    });
    const loadPolicyReadiness = jest.fn().mockResolvedValue([
      { status_id: 'ready', policy_count: 2 },
    ]);

    const service = createCandidateBoundVerificationRemediationReadinessService({
      database,
      createMetricsService: jest.fn().mockReturnValue({ getSummary }),
      loadProviderConfiguration,
      loadPolicyReadiness,
    });

    const report = await service.getReport({ windowDays: 14 });

    expect(getSummary).toHaveBeenCalledWith({ windowDays: 14 });
    expect(loadProviderConfiguration).toHaveBeenCalledWith(database);
    expect(loadPolicyReadiness).toHaveBeenCalledWith(database);
    expect(report).toMatchObject({
      providerAdmission: { admitted: true, providerCalled: false },
      policyReadiness: { allActivePoliciesReady: true },
      readiness: { statusId: 'ready' },
    });
  });
});
