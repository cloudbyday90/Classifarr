/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import { buildAiProviderAuthorityProfile } from '../../services/aiProviderAuthority.mjs';
import {
  buildOllamaVerificationCapabilityRuntimeInvalidationTarget,
} from '../../services/ollamaVerificationCapabilityRuntimeInvalidation.mjs';
import {
  markOllamaVerificationCapabilityModelChanged,
} from '../../services/ollamaVerificationCapabilityRuntimeInvalidationRepository.mjs';
import {
  createOllamaVerificationCapabilityRuntimeInvalidationService,
} from '../../services/ollamaVerificationCapabilityRuntimeInvalidationService.mjs';

const verifiedAuthority = buildAiProviderAuthorityProfile({
  providerId: 'ollama',
  model: 'gemma4:e4b',
  requestedMode: 'verification',
  ollamaVerificationCapability: {
    providerId: 'ollama',
    model: 'gemma4:e4b',
    verified: true,
    modelDigest: 'a'.repeat(64),
  },
});

function mismatchObservation(overrides = {}) {
  return {
    provider: {
      type: 'ollama',
      config: {
        model: 'gemma4:e4b',
        verificationModelDigest: 'a'.repeat(64),
        verificationConfigurationRevision: 4,
        verificationConfigurationFingerprint: 'b'.repeat(64),
      },
    },
    authority: verifiedAuthority,
    generationError: Object.assign(new Error('model changed'), {
      code: 'MODEL_DIGEST_MISMATCH',
    }),
    ...overrides,
  };
}

describe('ollama verification capability runtime invalidation', () => {
  test('accepts only a complete strict Ollama digest-mismatch observation', () => {
    expect(buildOllamaVerificationCapabilityRuntimeInvalidationTarget(
      mismatchObservation(),
    )).toEqual({
      model: 'gemma4:e4b',
      expectedModelDigest: 'a'.repeat(64),
      configurationRevision: 4,
      configurationFingerprint: 'b'.repeat(64),
    });

    expect(buildOllamaVerificationCapabilityRuntimeInvalidationTarget(
      mismatchObservation({ generationError: { code: 'ECONNREFUSED' } }),
    )).toBeNull();
    expect(buildOllamaVerificationCapabilityRuntimeInvalidationTarget(
      mismatchObservation({ authority: { ...verifiedAuthority, effectiveMode: 'proposal' } }),
    )).toBeNull();
  });

  test('uses a conditional parameterized update that cannot revoke a newer test', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    const target = buildOllamaVerificationCapabilityRuntimeInvalidationTarget(mismatchObservation());

    await expect(markOllamaVerificationCapabilityModelChanged(database, target)).resolves.toBe(true);

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("ollama_verification_capability_status = 'verification_ready'"),
      [
        'MODEL_DIGEST_MISMATCH',
        'gemma4:e4b',
        4,
        'b'.repeat(64),
        'a'.repeat(64),
      ],
    );
  });

  test('fails open when the diagnostic persistence update is unavailable', async () => {
    const database = { query: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const logger = { warn: jest.fn() };
    const service = createOllamaVerificationCapabilityRuntimeInvalidationService({ database, logger });

    await expect(service.invalidateFromGenerationError(mismatchObservation())).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'Ollama verification capability runtime invalidation failed',
      { failureCode: 'persistence_unavailable' },
    );
  });
});
