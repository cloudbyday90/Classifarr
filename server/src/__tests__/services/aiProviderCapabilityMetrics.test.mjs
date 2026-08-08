/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { buildAiProviderAuthorityProfile } from '../../services/aiProviderAuthority.mjs';
import { buildAiProviderCapabilityMetricDelta } from '../../services/aiProviderCapabilityMetrics.mjs';
import { incrementAiProviderCapabilityMetrics } from '../../services/aiProviderCapabilityMetricsRepository.mjs';
import { createAiProviderCapabilityMetricsService } from '../../services/aiProviderCapabilityMetricsService.mjs';

describe('aiProviderCapabilityMetrics', () => {
  test('records only fixed outcome counters for normalized output', () => {
    const delta = buildAiProviderCapabilityMetricDelta({
      authority: buildAiProviderAuthorityProfile({
        providerId: 'ollama',
        model: 'qwen3:8b',
      }),
      parseResult: {
        format: 'contract_violation',
        policy_question: {
          meta: {
            violation_reason: 'no_valid_options',
            validation_errors: 'Unknown library option and route action',
          },
        },
      },
      diagnostics: { repair_attempted: true, repair_succeeded: false },
      generationError: { code: 'EINCOMPLETE' },
      thinkingTraceDetected: true,
    });

    expect(delta).toEqual(expect.objectContaining({
      providerId: 'ollama',
      authorityMode: 'proposal',
      requestCount: 1,
      structuredParseSuccessCount: 0,
      semanticContractViolationCount: 1,
      repairAttemptCount: 1,
      repairSuccessCount: 0,
      timeoutOrIncompleteStreamCount: 1,
      hallucinatedLibraryReferenceCount: 1,
      hallucinatedActionCount: 1,
      thinkingTraceLeakageCount: 1,
    }));
    expect(JSON.stringify(delta)).not.toContain('Unknown library option');
  });

  test('does not retain provider exception text in aggregate telemetry', () => {
    const delta = buildAiProviderCapabilityMetricDelta({
      authority: buildAiProviderAuthorityProfile({ providerId: 'openai', model: 'gpt-4.1' }),
      generationError: new Error('provider key=fixture-secret must not persist'),
    });

    expect(JSON.stringify(delta)).not.toContain('fixture-secret');
    expect(delta).toEqual(expect.objectContaining({
      requestCount: 1,
      timeoutOrIncompleteStreamCount: 0,
    }));
  });

  test('uses parameterized upserts and fails open when telemetry is unavailable', async () => {
    const database = { query: jest.fn().mockRejectedValue(new Error('metrics table unavailable')) };
    const logger = { warn: jest.fn() };
    const service = createAiProviderCapabilityMetricsService({ database, logger });

    const delta = await service.record({
      authority: buildAiProviderAuthorityProfile({ providerId: 'gemini', model: 'gemini-2.5-pro' }),
      parseResult: { format: 'CONFIDENT' },
    });

    expect(delta.structuredParseSuccessCount).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'AI provider capability metric write failed',
      expect.objectContaining({ providerId: 'gemini' }),
    );

    const writableDatabase = { query: jest.fn().mockResolvedValue({}) };
    await incrementAiProviderCapabilityMetrics(writableDatabase, delta);
    expect(writableDatabase.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (provider_id, model, authority_mode)'),
      expect.arrayContaining(['gemini', 'gemini-2.5-pro', 'proposal']),
    );
  });
});
