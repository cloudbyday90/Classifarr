/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_AUTHORITY_MODE_IDS,
  buildAiProviderAuthorityProfile,
} from '../../services/aiProviderAuthority.mjs';
import {
  buildClassificationAiRepairProvenance,
  resolveClassificationAiRepairAuthority,
} from '../../services/classificationAiRepairAuthority.mjs';

describe('classificationAiRepairAuthority', () => {
  test('downgrades a cloud repair to the actual local fallback provider', () => {
    const sourceAuthority = buildAiProviderAuthorityProfile({
      providerId: 'openai',
      model: 'gpt-4o',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
    });

    const authority = resolveClassificationAiRepairAuthority({
      sourceAuthority,
      repairModel: 'qwen3:8b',
    });

    expect(authority).toEqual(expect.objectContaining({
      providerId: 'ollama',
      model: 'qwen3:8b',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
      effectiveMode: AI_PROVIDER_AUTHORITY_MODE_IDS.FALLBACK_ADVISORY,
      isFallback: true,
      capabilities: expect.objectContaining({ contractGrade: false }),
      sideEffects: expect.objectContaining({ canRoute: false }),
    }));
  });

  test('preserves direct Ollama authority when repair uses the same model', () => {
    const sourceAuthority = buildAiProviderAuthorityProfile({
      providerId: 'ollama',
      model: 'qwen3:8b',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL,
    });

    expect(resolveClassificationAiRepairAuthority({
      sourceAuthority,
      repairModel: 'qwen3:8b',
    })).toBe(sourceAuthority);
  });

  test('downgrades local repair when its model differs from the source model', () => {
    const sourceAuthority = buildAiProviderAuthorityProfile({
      providerId: 'ollama',
      model: 'qwen3:14b',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL,
    });

    const authority = resolveClassificationAiRepairAuthority({
      sourceAuthority,
      repairModel: 'qwen3:8b',
    });

    expect(authority).toEqual(expect.objectContaining({
      providerId: 'ollama',
      model: 'qwen3:8b',
      effectiveMode: AI_PROVIDER_AUTHORITY_MODE_IDS.FALLBACK_ADVISORY,
      isFallback: true,
    }));
  });

  test('builds bounded repair provenance without model output or item data', () => {
    const sourceAuthority = buildAiProviderAuthorityProfile({
      providerId: 'gemini',
      model: 'gemini-2.5-pro',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
    });
    const repairAuthority = resolveClassificationAiRepairAuthority({
      sourceAuthority,
      repairModel: 'qwen3:8b',
    });

    expect(buildClassificationAiRepairProvenance({
      sourceAuthority,
      repairAuthority,
    })).toEqual({
      version: 'classification.ai_repair_provenance.v1',
      source: {
        provider_id: 'gemini',
        model: 'gemini-2.5-pro',
        effective_mode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
        is_fallback: false,
      },
      repair: {
        provider_id: 'ollama',
        model: 'qwen3:8b',
        effective_mode: AI_PROVIDER_AUTHORITY_MODE_IDS.FALLBACK_ADVISORY,
        is_fallback: true,
      },
      cross_provider: true,
      cross_model: true,
    });
  });
});
