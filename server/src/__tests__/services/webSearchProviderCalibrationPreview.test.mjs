/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { WebSearchProviderCalibrationPreviewService } from '../../services/webSearchProviderCalibrationPreview.mjs';

function createCandidate(providerKey, overrides = {}) {
  return {
    providerKey,
    displayName: providerKey === 'tavily' ? 'Tavily' : 'Brave Search',
    priority: providerKey === 'tavily' ? 10 : 5,
    effectivePriority: providerKey === 'tavily' ? 10 : 25,
    status: 'available',
    skipReason: null,
    adapter: { providerKey },
    config: {
      isEnabled: true,
      configured: true,
      apiKey: 'sensitive-api-key',
      config: { projectId: 'sensitive-project' },
    },
    quota: { dailyCostUnits: 1, monthlyCostUnits: 3 },
    usageSummary: { dailyRequestCount: 1, monthlyRequestCount: 3 },
    qualityCalibration: {
      score: providerKey === 'tavily' ? 100 : 50,
      priorityPenalty: providerKey === 'tavily' ? 0 : 20,
      sampleCount: 10,
      status: providerKey === 'tavily' ? 'healthy' : 'calibrated',
    },
    ...overrides,
  };
}

describe('webSearchProviderCalibrationPreview', () => {
  test('compares current route order with an unsaved calibration policy override', async () => {
    const currentCandidates = [
      createCandidate('tavily'),
      createCandidate('brave'),
    ];
    const previewCandidates = [
      createCandidate('brave', {
        effectivePriority: 5,
        qualityCalibration: {
          score: 100,
          priorityPenalty: 0,
          sampleCount: 10,
          status: 'healthy',
        },
      }),
      createCandidate('tavily', {
        effectivePriority: 20,
        qualityCalibration: {
          score: 60,
          priorityPenalty: 10,
          sampleCount: 10,
          status: 'calibrated',
        },
      }),
    ];
    const router = {
      nowFn: () => new Date('2026-06-25T12:00:00.000Z'),
      getRouteCandidates: jest.fn()
        .mockResolvedValueOnce(currentCandidates)
        .mockResolvedValueOnce(previewCandidates),
    };
    const healthHistory = {
      listRecentEvents: jest.fn(async () => [{
        providerKey: 'brave',
        eventType: 'error',
        healthStatus: 'degraded',
        errorCode: 'provider_5xx',
        createdAt: '2026-06-25T11:58:00.000Z',
      }]),
    };
    const guardrailThresholdService = {
      getThresholdsSafely: jest.fn(async () => ({
        enabled: true,
        lowSampleMultiplier: 1,
        recentHealthLookbackCount: 7,
        selectionChangeSeverity: 'info',
        lowSampleSeverity: 'warning',
        healthIssueSeverity: 'warning',
        cooldownSeverity: 'critical',
        noProviderSeverity: 'critical',
      })),
    };
    const service = new WebSearchProviderCalibrationPreviewService({
      router,
      healthHistory,
      guardrailThresholdService,
    });

    const preview = await service.previewPolicy({
      purpose: 'classification',
      isEnabled: true,
      lookbackDays: 30,
      minimumSamples: 5,
      maximumPriorityPenalty: 30,
      outcomeWeight: 20,
    });

    expect(preview).toEqual(expect.objectContaining({
      purpose: 'classification',
      generatedAt: '2026-06-25T12:00:00.000Z',
      selectedProviderKeyBefore: 'tavily',
      selectedProviderKeyAfter: 'brave',
      selectedProviderChanged: true,
      candidateCount: 2,
      policy: expect.objectContaining({
        lookbackDays: 30,
        minimumSamples: 5,
      }),
      guardrailThresholds: expect.objectContaining({
        recentHealthLookbackCount: 7,
      }),
      guardrails: [
        expect.objectContaining({ code: 'selected_provider_changed' }),
        expect.objectContaining({ code: 'selected_provider_recent_health_issue' }),
      ],
    }));
    expect(preview.changes).toEqual([
      expect.objectContaining({
        providerKey: 'brave',
        currentRank: 2,
        previewRank: 1,
        rankDirection: 'moved_up',
        priorityPenaltyDelta: -20,
      }),
      expect.objectContaining({
        providerKey: 'tavily',
        currentRank: 1,
        previewRank: 2,
        rankDirection: 'moved_down',
        priorityPenaltyDelta: 10,
      }),
    ]);
    expect(router.getRouteCandidates).toHaveBeenNthCalledWith(1, {
      purpose: 'classification',
    });
    expect(router.getRouteCandidates).toHaveBeenNthCalledWith(2, {
      purpose: 'classification',
      calibrationPolicyOverride: expect.objectContaining({
        purpose: 'classification',
        maximumPriorityPenalty: 30,
      }),
    });
    expect(guardrailThresholdService.getThresholdsSafely).toHaveBeenCalledTimes(1);
    expect(healthHistory.listRecentEvents).toHaveBeenCalledWith({ limit: 7 });
    expect(JSON.stringify(preview)).not.toContain('sensitive');
  });
});
