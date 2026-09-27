/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildOllamaVerificationAuthorityEvidence,
  getOllamaVerificationCapabilityState,
  resolveOllamaVerificationCapabilityIdentity,
} from '../../services/ollamaVerificationCapabilityIdentity.mjs';

const baseConfiguration = Object.freeze({
  primary_provider: 'ollama',
  ollama_host: 'ollama',
  ollama_port: 11434,
  ollama_model: 'gemma4:e4b',
  configuration_revision: 4,
});
const fixtureClock = { now: Date.parse('2026-08-29T12:00:00.000Z') };

function readyConfiguration(overrides = {}) {
  const identity = resolveOllamaVerificationCapabilityIdentity(baseConfiguration);
  return {
    ...baseConfiguration,
    ollama_verification_capability_status: 'verification_ready',
    ollama_verification_capability_fingerprint: identity.fingerprint,
    ollama_verification_capability_configuration_revision: 4,
    ollama_verification_capability_model_digest: 'a'.repeat(64),
    ollama_verification_capability_checked_at: new Date('2026-08-28T12:00:00.000Z').toISOString(),
    ...overrides,
  };
}

describe('ollama verification capability identity', () => {
  test('keeps the thirty-day boundary and rejects expired or future evidence', () => {
    const checkedAt = Date.parse('2026-08-28T12:00:00.000Z');
    const boundary = checkedAt + 30 * 24 * 60 * 60 * 1000;
    expect(getOllamaVerificationCapabilityState(readyConfiguration(), { now: boundary }).verificationReady).toBe(true);
    for (const now of [boundary + 1, checkedAt - 1]) {
      expect(getOllamaVerificationCapabilityState(readyConfiguration(), { now })).toMatchObject({
        current: false, verificationReady: false, statusId: 'not_checked',
      });
    }
  });
  test('provides authority evidence only for a current bound structured-output result', () => {
    const state = getOllamaVerificationCapabilityState(readyConfiguration(), {
      now: Date.parse('2026-08-29T12:00:00.000Z'),
    });

    expect(state).toMatchObject({
      statusId: 'verification_ready',
      verificationReady: true,
      modelDigest: 'a'.repeat(64),
    });
    expect(buildOllamaVerificationAuthorityEvidence(readyConfiguration(), {
      now: Date.parse('2026-08-29T12:00:00.000Z'),
    })).toEqual({
      providerId: 'ollama',
      model: 'gemma4:e4b',
      verified: true,
      modelDigest: 'a'.repeat(64),
    });
  });

  test('fails closed when a saved configuration revision or model changes', () => {
    const changedRevision = getOllamaVerificationCapabilityState(readyConfiguration({
      configuration_revision: 5,
    }), fixtureClock);
    const changedModel = getOllamaVerificationCapabilityState(readyConfiguration({
      ollama_model: 'gemma4:latest',
    }), fixtureClock);

    expect(changedRevision.statusId).toBe('not_checked');
    expect(changedRevision.verificationReady).toBe(false);
    expect(changedModel.statusId).toBe('not_checked');
    expect(changedModel.verificationReady).toBe(false);
  });

  test('retains a current model-change status without granting verification authority', () => {
    const configuration = readyConfiguration({
      ollama_verification_capability_status: 'model_changed',
      ollama_verification_capability_model_digest: null,
      ollama_verification_capability_error_code: 'MODEL_DIGEST_MISMATCH',
    });
    const state = getOllamaVerificationCapabilityState(configuration, fixtureClock);

    expect(state).toMatchObject({
      statusId: 'model_changed',
      current: true,
      verificationReady: false,
      errorCode: 'MODEL_DIGEST_MISMATCH',
      modelDigest: null,
    });
    expect(buildOllamaVerificationAuthorityEvidence(configuration, fixtureClock)).toEqual(expect.objectContaining({
      verified: false,
      modelDigest: null,
    }));
  });

  test.each([
    ['classification_only', 'structured_response_invalid'],
    ['unavailable', 'connectivity_timeout'],
  ])('retains a current %s result without granting verification authority', (statusId, errorCode) => {
    const configuration = readyConfiguration({
      ollama_verification_capability_status: statusId,
      ollama_verification_capability_model_digest: null,
      ollama_verification_capability_error_code: errorCode,
    });

    const state = getOllamaVerificationCapabilityState(configuration, fixtureClock);

    expect(state).toMatchObject({
      statusId,
      current: true,
      verificationReady: false,
      errorCode,
      modelDigest: null,
    });
    expect(buildOllamaVerificationAuthorityEvidence(configuration, fixtureClock)).toEqual(expect.objectContaining({
      verified: false,
      modelDigest: null,
    }));
  });
});
