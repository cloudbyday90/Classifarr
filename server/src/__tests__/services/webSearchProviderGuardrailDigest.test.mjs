/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildGuardrailDigestFinding,
  WebSearchProviderGuardrailDigestService,
} from '../../services/webSearchProviderGuardrailDigest.mjs';

describe('webSearchProviderGuardrailDigest', () => {
  test('builds attention findings for critical guardrail activity', () => {
    const finding = buildGuardrailDigestFinding({
      guardrailCode: 'selected_provider_recent_health_issue',
      totalCount: 2,
      criticalCount: 1,
      warningCount: 1,
      infoCount: 0,
      providerCount: 1,
      latestAt: '2026-06-25T06:00:00.000Z',
    }, {
      criticalEventThreshold: 1,
      warningEventThreshold: 5,
      totalEventThreshold: 10,
    });

    expect(finding).toEqual({
      guardrailCode: 'selected_provider_recent_health_issue',
      level: 'attention',
      dominantSeverity: 'critical',
      totalCount: 2,
      criticalCount: 1,
      warningCount: 1,
      infoCount: 0,
      providerCount: 1,
      latestAt: '2026-06-25T06:00:00.000Z',
      message: 'Preview-selected providers have repeated recent health or cooldown signals.',
      recommendation: 'Inspect provider health history and cooldown settings before relying on this provider for the purpose.',
    });
  });

  test('builds watch findings for repeated warning activity', () => {
    const finding = buildGuardrailDigestFinding({
      guardrailCode: 'selected_provider_low_samples',
      totalCount: 6,
      criticalCount: 0,
      warningCount: 5,
      infoCount: 1,
      providerCount: 2,
      latestAt: '2026-06-25T06:00:00.000Z',
    }, {
      criticalEventThreshold: 1,
      warningEventThreshold: 5,
      totalEventThreshold: 10,
    });

    expect(finding).toEqual(expect.objectContaining({
      guardrailCode: 'selected_provider_low_samples',
      level: 'watch',
      dominantSeverity: 'warning',
      message: 'Preview-selected providers often have weak sample confidence.',
    }));
  });

  test('omits findings below digest thresholds', () => {
    const finding = buildGuardrailDigestFinding({
      guardrailCode: 'selected_provider_changed',
      totalCount: 2,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 2,
      providerCount: 1,
      latestAt: '2026-06-25T06:00:00.000Z',
    }, {
      criticalEventThreshold: 1,
      warningEventThreshold: 5,
      totalEventThreshold: 10,
    });

    expect(finding).toBeNull();
  });

  test('builds a bounded digest from guardrail analytics', async () => {
    const analyticsService = {
      summarize: async () => ({
        generatedAt: '2026-06-25T06:00:00.000Z',
        lookbackDays: 7,
        totalCount: 18,
        criticalCount: 1,
        warningCount: 8,
        infoCount: 9,
        purposeCount: 2,
        latestAt: '2026-06-25T05:59:00.000Z',
        codes: [
          {
            guardrailCode: 'selected_provider_recent_health_issue',
            totalCount: 2,
            criticalCount: 1,
            warningCount: 1,
            infoCount: 0,
            providerCount: 1,
            latestAt: '2026-06-25T05:59:00.000Z',
          },
          {
            guardrailCode: 'selected_provider_low_samples',
            totalCount: 6,
            criticalCount: 0,
            warningCount: 5,
            infoCount: 1,
            providerCount: 2,
            latestAt: '2026-06-25T05:58:00.000Z',
          },
        ],
        purposes: [],
      }),
    };
    const service = new WebSearchProviderGuardrailDigestService({
      analyticsService,
      nowFn: () => new Date('2026-06-25T06:05:00.000Z'),
    });

    const digest = await service.buildDigest({ lookbackDays: 999, maxFindings: 1 });

    expect(digest).toEqual({
      generatedAt: '2026-06-25T06:05:00.000Z',
      level: 'attention',
      lookbackDays: 62,
      policy: {
        lookbackDays: 62,
        maxFindings: 1,
        criticalEventThreshold: 1,
        warningEventThreshold: 5,
        totalEventThreshold: 10,
      },
      summary: {
        totalCount: 18,
        criticalCount: 1,
        warningCount: 8,
        infoCount: 9,
        purposeCount: 2,
        latestAt: '2026-06-25T05:59:00.000Z',
      },
      findings: [
        expect.objectContaining({
          guardrailCode: 'selected_provider_recent_health_issue',
          level: 'attention',
        }),
      ],
      message: 'Guardrail activity crossed digest thresholds and should be reviewed before further calibration changes.',
    });
  });
});
