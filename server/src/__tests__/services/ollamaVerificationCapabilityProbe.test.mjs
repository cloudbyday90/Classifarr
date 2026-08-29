/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  resolveOllamaVerificationCapabilityIdentity,
} from '../../services/ollamaVerificationCapabilityIdentity.mjs';
import {
  OLLAMA_VERIFICATION_CAPABILITY_PROBE_RESPONSE_SCHEMA,
  probeOllamaVerificationCapability,
} from '../../services/ollamaVerificationCapabilityProbe.mjs';

const identity = resolveOllamaVerificationCapabilityIdentity({
  primary_provider: 'ollama',
  ollama_host: 'ollama',
  ollama_port: 11434,
  ollama_model: 'gemma4:e4b',
  configuration_revision: 4,
});

describe('ollama verification capability probe', () => {
  test('requires a reachable installed model and a semantically valid structured response', async () => {
    const ollamaClient = {
      preflightConnection: jest.fn().mockResolvedValue({
        success: true,
        models: [{ name: 'gemma4:e4b', digest: 'a'.repeat(64) }],
      }),
      generate: jest.fn().mockResolvedValue(JSON.stringify({
        status: 'ready',
        contract: 'candidate-bound-verification',
      })),
    };

    const outcome = await probeOllamaVerificationCapability({ identity, ollamaClient });

    expect(outcome).toMatchObject({
      statusId: 'verification_ready',
      modelDigest: 'a'.repeat(64),
      configurationRevision: 4,
    });
    expect(ollamaClient.generate).toHaveBeenCalledWith(
      expect.stringContaining('candidate-bound-verification'),
      'gemma4:e4b',
      0,
      {
        format: OLLAMA_VERIFICATION_CAPABILITY_PROBE_RESPONSE_SCHEMA,
        think: false,
      },
    );
  });

  test('never persists provider output when a schema response is invalid', async () => {
    const ollamaClient = {
      preflightConnection: jest.fn().mockResolvedValue({
        success: true,
        models: [{ name: 'gemma4:e4b', digest: 'a'.repeat(64) }],
      }),
      generate: jest.fn().mockResolvedValue('{"status":"wrong","secret":"not-retained"}'),
    };

    const outcome = await probeOllamaVerificationCapability({ identity, ollamaClient });

    expect(outcome).toMatchObject({
      statusId: 'classification_only',
      errorCode: 'structured_response_invalid',
      modelDigest: null,
    });
    expect(JSON.stringify(outcome)).not.toContain('not-retained');
  });

  test('does not generate when preflight cannot reach the saved Ollama configuration', async () => {
    const ollamaClient = {
      preflightConnection: jest.fn().mockResolvedValue({
        success: false,
        failureType: 'connectivity_timeout',
      }),
      generate: jest.fn(),
    };

    const outcome = await probeOllamaVerificationCapability({ identity, ollamaClient });

    expect(outcome).toMatchObject({
      statusId: 'unavailable',
      errorCode: 'connectivity_timeout',
    });
    expect(ollamaClient.generate).not.toHaveBeenCalled();
  });
});
