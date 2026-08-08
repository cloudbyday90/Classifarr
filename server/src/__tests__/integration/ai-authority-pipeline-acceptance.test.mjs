/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This acceptance suite uses the isolated integration database and an
 * in-process provider transport. It never reads a configured provider key or
 * reaches an external model endpoint.
 */

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { AIRouterService } = await import('../../services/aiRouter.mjs');
const {
  AI_PROVIDER_AUTHORITY_MODE_IDS,
} = await import('../../services/aiProviderAuthority.mjs');
const {
  normalizeAiProviderOutput,
} = await import('../../services/aiProviderOutputNormalization.mjs');
const {
  attachAiProviderAuthorityToClassificationResult,
} = await import('../../services/classificationAiAuthorityAttachment.mjs');
const { classificationResponseSchema } = await import('../../services/aiResponseSchema.mjs');
const { aiResponseParser } = await import('../../services/aiResponseParser.mjs');
const { ClassificationService } = await import('../../services/classificationServiceCore.mjs');

const libraries = [
  { id: 1, name: 'Animation', media_type: 'movie' },
  { id: 2, name: 'Drama', media_type: 'movie' },
];

function createTransport() {
  return {
    chat: jest.fn(),
    checkBudget: jest.fn().mockResolvedValue({ exhausted: false }),
  };
}

function createOllamaTransport() {
  return {
    generate: jest.fn(),
    testConnection: jest.fn(),
  };
}

function createClassificationService() {
  return new ClassificationService({
    createLogger: () => ({ debug: jest.fn() }),
    normalizePolicyDecisionThresholds: () => ({ autoClassifyThreshold: 85 }),
  });
}

async function configureProvider({ providerId, model = 'gpt-4.1' }) {
  await db.query('TRUNCATE TABLE ai_provider_config RESTART IDENTITY CASCADE');
  await db.query(
    `INSERT INTO ai_provider_config (id, primary_provider, api_key, model, temperature)
     VALUES (1, $1, 'integration-fixture-only', $2, 0.2)`,
    [providerId, model],
  );
}

describe('AI authority pipeline acceptance', () => {
  let cloudTransport;
  let ollamaTransport;
  let router;

  beforeEach(() => {
    cloudTransport = createTransport();
    ollamaTransport = createOllamaTransport();
    router = new AIRouterService({
      cloudLLMService: cloudTransport,
      ollamaClient: ollamaTransport,
    });
  });

  test('disabled authority stops before a configured provider transport is called', async () => {
    await configureProvider({ providerId: 'openai' });

    await expect(router.classify('classify this item', {
      authorityMode: AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED,
      requireAuthorityMode: true,
      format: classificationResponseSchema,
    })).rejects.toThrow('AI output is disabled by authority mode');

    expect(cloudTransport.chat).not.toHaveBeenCalled();
    expect(ollamaTransport.generate).not.toHaveBeenCalled();
  });

  test('strict verification without a schema stops before provider invocation', async () => {
    await configureProvider({ providerId: 'openai' });

    await expect(router.classify('verify this item', {
      authorityMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
      requireAuthorityMode: true,
    })).rejects.toThrow('without a structured response schema');

    expect(cloudTransport.chat).not.toHaveBeenCalled();
    expect(ollamaTransport.generate).not.toHaveBeenCalled();
  });

  test('a local provider cannot satisfy requested verification authority', async () => {
    await configureProvider({ providerId: 'ollama', model: 'llama3.2' });

    await expect(router.classify('verify this item', {
      authorityMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
      requireAuthorityMode: true,
      format: classificationResponseSchema,
    })).rejects.toThrow('cannot satisfy verification authority');

    expect(cloudTransport.chat).not.toHaveBeenCalled();
    expect(ollamaTransport.generate).not.toHaveBeenCalled();
  });

  test('a schema-bound verified response is normalized, parsed, and remains unable to route', async () => {
    await configureProvider({ providerId: 'openai' });
    cloudTransport.chat.mockResolvedValue({
      content: [
        '<think>private model trace that must not cross the parser boundary</think>',
        '```json',
        JSON.stringify({
          decision: 'CONFIRM',
          library_number: 1,
          confidence: null,
          reason: 'Observed evidence matches the established library purpose.',
          problem_summary: null,
          why_uncertain: null,
          question: null,
          options: null,
        }),
        '```',
      ].join('\n'),
    });

    const provider = await router.getProvider('classification', {
      authorityMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
    });
    const rawResponse = await router.classify('verify this item', {
      provider,
      authorityMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
      requireAuthorityMode: true,
      format: classificationResponseSchema,
    });
    const normalized = normalizeAiProviderOutput(rawResponse);
    const parsed = aiResponseParser.parse(normalized.normalizedOutput, {
      libraries,
      metadata: { title: 'Acceptance Fixture', media_type: 'movie' },
      signalContext: {
        suggestedLibrary: libraries[0],
        confidence: 93,
        breakdown: [],
      },
    }, { mode: 'verify' });
    const result = attachAiProviderAuthorityToClassificationResult({
      result: {
        ...parsed,
        method: 'ai_verified',
      },
      authority: provider.authority,
    });
    const decision = createClassificationService().buildAutoRouteDecision({
      result,
      policyAutoThreshold: 85,
    });

    expect(cloudTransport.chat).toHaveBeenCalledTimes(1);
    expect(normalized.thinkingTraceDetected).toBe(true);
    expect(normalized.normalizedOutput).not.toContain('<think>');
    expect(normalized.normalizedOutput).not.toContain('```');
    expect(parsed).toEqual(expect.objectContaining({
      library: libraries[0],
      confidence: 93,
      verified_by_ai: true,
    }));
    expect(result.ai_authority).toEqual(expect.objectContaining({
      effectiveMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
      sideEffects: expect.objectContaining({ canRoute: false }),
    }));
    expect(decision).toEqual({
      shouldRoute: false,
      reason: 'ai_authority_advisory',
    });
  });
});
