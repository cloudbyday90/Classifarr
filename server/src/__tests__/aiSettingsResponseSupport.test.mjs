/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { maskToken } from '../utils/tokenMasking.mjs';
import {
  finalizeAiSettingsResponseConfig,
  stripAiSettingsInternalState,
} from '../routes/helpers/aiSettingsResponseSupport.mjs';

describe('aiSettingsResponseSupport', () => {
  test('stripAiSettingsInternalState removes internal-only columns in place', () => {
    const config = {
      rag_loop_auto_fallback_last_version: 9,
      rag_loop_auto_recover_last_attempt_at: '2026-05-12T00:00:00.000Z',
      image_embedding_models_cache: { stale: true },
      image_embedding_models_cache_updated_at: '2026-05-12T00:00:00.000Z',
      model: 'gpt-5.2',
    };

    const strippedConfig = stripAiSettingsInternalState(config);

    expect(strippedConfig).toBe(config);
    expect(config.rag_loop_auto_fallback_last_version).toBeUndefined();
    expect(config.rag_loop_auto_recover_last_attempt_at).toBeUndefined();
    expect(config.image_embedding_models_cache).toBeUndefined();
    expect(config.image_embedding_models_cache_updated_at).toBeUndefined();
    expect(config.model).toBe('gpt-5.2');
  });

  test('finalizeAiSettingsResponseConfig applies normalized config, masks secrets, normalizes image embedding config, and strips internal state when requested', () => {
    const config = {
      api_key: 'live-ai-key',
      embedding_cloud_api_key: 'live-embedding-key',
      image_embedding_cloud_api_key: 'live-image-key',
      image_embedding_local_api_key: 'enc_local$iv$tag',
      image_embedding_provider_mode: 'same',
      image_embedding_local_host: '',
      image_embedding_local_port: 11434,
      image_embedding_models_cache: { stale: true },
    };

    const finalizedConfig = finalizeAiSettingsResponseConfig({
      config,
      normalizedConfig: {
        model: 'gpt-5.2',
      },
      parseEncryptedValue: jest.fn(() => ({ encrypted: 'enc_local', iv: 'iv', authTag: 'tag' })),
      decryptValue: jest.fn(() => 'local-secret'),
      stripInternalState: true,
    });

    expect(finalizedConfig).toBe(config);
    expect(config.model).toBe('gpt-5.2');
    expect(config.api_key).toBe(maskToken('live-ai-key'));
    expect(config.embedding_cloud_api_key).toBe(maskToken('live-embedding-key'));
    expect(config.image_embedding_cloud_api_key).toBe(maskToken('live-image-key'));
    expect(config.image_embedding_local_api_key).toBe(maskToken('local-secret'));
    expect(config.image_embedding_provider_mode).toBe('disabled');
    expect(config.image_embedding_local_port).toBe(8000);
    expect(config.image_embedding_models_cache).toBeUndefined();
  });

  test('finalizeAiSettingsResponseConfig returns falsy configs unchanged', () => {
    expect(finalizeAiSettingsResponseConfig({ config: null })).toBeNull();
    expect(finalizeAiSettingsResponseConfig({ config: undefined })).toBeUndefined();
  });

  test('finalizeAiSettingsResponseConfig allows omitted normalizedConfig for response-only masking', () => {
    const config = {
      api_key: 'live-ai-key',
      image_embedding_provider_mode: 'same',
      image_embedding_local_host: '',
      image_embedding_local_port: 11434,
    };

    const finalizedConfig = finalizeAiSettingsResponseConfig({
      config,
      parseEncryptedValue: jest.fn(),
      decryptValue: jest.fn(),
    });

    expect(finalizedConfig).toBe(config);
    expect(config.api_key).toBe(maskToken('live-ai-key'));
    expect(config.image_embedding_provider_mode).toBe('disabled');
    expect(config.image_embedding_local_port).toBe(8000);
  });
});

