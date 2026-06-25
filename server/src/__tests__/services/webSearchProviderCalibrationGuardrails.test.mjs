/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildWebSearchProviderCalibrationGuardrails } from '../../services/webSearchProviderCalibrationGuardrails.mjs';

function createPreview(overrides = {}) {
  return {
    selectedProviderKeyBefore: 'tavily',
    selectedProviderKeyAfter: 'brave',
    selectedProviderChanged: true,
    candidateCount: 2,
    current: {
      candidates: [
        { providerKey: 'tavily', displayName: 'Tavily' },
        { providerKey: 'brave', displayName: 'Brave Search' },
      ],
    },
    preview: {
      candidates: [
        {
          providerKey: 'brave',
          displayName: 'Brave Search',
          quality: {
            sampleCount: 1,
            minimumSamples: 3,
            status: 'insufficient_data',
          },
        },
        { providerKey: 'tavily', displayName: 'Tavily', quality: { sampleCount: 10, minimumSamples: 3 } },
      ],
    },
    ...overrides,
  };
}

describe('webSearchProviderCalibrationGuardrails', () => {
  test('builds safe guardrails for route changes, low samples, and recent health issues', () => {
    const guardrails = buildWebSearchProviderCalibrationGuardrails(createPreview(), {
      recentHealthEvents: [{
        id: 12,
        providerKey: 'brave',
        eventType: 'cooldown_started',
        healthStatus: 'cooldown',
        errorCode: 'rate_limited',
        correlationId: 'sensitive-correlation',
        classificationId: 123,
        cooldownUntil: '2026-06-25T12:05:00.000Z',
        createdAt: '2026-06-25T12:00:00.000Z',
      }],
    });

    expect(guardrails).toEqual([
      expect.objectContaining({
        code: 'selected_provider_changed',
        severity: 'info',
        providerKey: 'brave',
      }),
      expect.objectContaining({
        code: 'selected_provider_low_samples',
        severity: 'warning',
        providerKey: 'brave',
        details: expect.objectContaining({
          sampleCount: 1,
          minimumSamples: 3,
        }),
      }),
      expect.objectContaining({
        code: 'selected_provider_recent_health_issue',
        severity: 'critical',
        providerKey: 'brave',
        details: expect.objectContaining({
          recentIssueCount: 1,
          latestErrorCode: 'rate_limited',
          latestCooldownUntil: '2026-06-25T12:05:00.000Z',
        }),
      }),
    ]);
    expect(JSON.stringify(guardrails)).not.toContain('sensitive-correlation');
    expect(JSON.stringify(guardrails)).not.toContain('classificationId');
  });

  test('returns a critical guardrail when no provider would be selected', () => {
    const guardrails = buildWebSearchProviderCalibrationGuardrails(createPreview({
      selectedProviderKeyAfter: null,
      selectedProviderChanged: true,
      preview: { candidates: [] },
      candidateCount: 0,
    }));

    expect(guardrails[0]).toEqual(expect.objectContaining({
      code: 'no_preview_provider',
      severity: 'critical',
      providerKey: null,
    }));
  });

  test('applies threshold controls without changing the preview model', () => {
    const guardrails = buildWebSearchProviderCalibrationGuardrails(createPreview(), {
      thresholds: {
        enabled: true,
        lowSampleMultiplier: 2,
        recentHealthLookbackCount: 0,
        selectionChangeSeverity: 'warning',
        lowSampleSeverity: 'critical',
        healthIssueSeverity: 'warning',
        cooldownSeverity: 'critical',
        noProviderSeverity: 'critical',
      },
    });

    expect(guardrails).toEqual([
      expect.objectContaining({
        code: 'selected_provider_changed',
        severity: 'warning',
      }),
      expect.objectContaining({
        code: 'selected_provider_low_samples',
        severity: 'critical',
        details: expect.objectContaining({
          thresholdSampleCount: 6,
          lowSampleMultiplier: 2,
        }),
      }),
    ]);
  });

  test('returns no guardrails when threshold policy is disabled', () => {
    const guardrails = buildWebSearchProviderCalibrationGuardrails(createPreview(), {
      thresholds: { enabled: false },
    });

    expect(guardrails).toEqual([]);
  });
});
