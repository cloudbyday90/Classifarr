/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { maskToken } from '../utils/tokenMasking.mjs';
import {
  maskAiSettingsSecretFields,
  normalizeImageEmbeddingConfigState,
  resolveStoredImageEmbeddingLocalApiKey,
  resolveStoredSecretValue,
} from '../routes/helpers/aiSettingsConfigSupport.mjs';

describe('aiSettingsConfigSupport', () => {
  test('resolveStoredSecretValue preserves existing values for masked and omitted submissions', () => {
    expect(resolveStoredSecretValue(maskToken('stored-secret'), 'stored-secret')).toBe('stored-secret');
    expect(resolveStoredSecretValue(undefined, 'stored-secret')).toBe('stored-secret');
    expect(resolveStoredSecretValue(null, 'stored-secret')).toBe('stored-secret');
    expect(resolveStoredSecretValue('new-secret', 'stored-secret')).toBe('new-secret');
    expect(resolveStoredSecretValue(undefined, '')).toBe('');
  });

  test('resolveStoredImageEmbeddingLocalApiKey clears empty submissions and logs the clear action', () => {
    const logger = { info: jest.fn() };

    const resolvedValue = resolveStoredImageEmbeddingLocalApiKey({
      submittedValue: '   ',
      existingValue: 'enc_existing',
      encryptValue: jest.fn(),
      formatEncryptedValue: jest.fn(),
      logger,
    });

    expect(resolvedValue).toBeNull();
    expect(logger.info).toHaveBeenCalledWith('[AUDIT] Sidecar API key updated', { action: 'cleared' });
  });

  test('resolveStoredImageEmbeddingLocalApiKey preserves masked values and encrypts plaintext values', () => {
    const logger = { info: jest.fn() };
    const encryptValue = jest.fn(() => ({ encrypted: 'enc_plain', iv: 'iv', authTag: 'tag' }));
    const formatEncryptedValue = jest.fn((encrypted, iv, authTag) => `${encrypted}$${iv}$${authTag}`);

    const preservedValue = resolveStoredImageEmbeddingLocalApiKey({
      submittedValue: maskToken('stored-secret'),
      existingValue: 'enc_existing',
      encryptValue,
      formatEncryptedValue,
      logger,
    });
    const encryptedValue = resolveStoredImageEmbeddingLocalApiKey({
      submittedValue: 'plain-secret',
      existingValue: 'enc_existing',
      encryptValue,
      formatEncryptedValue,
      logger,
    });

    expect(preservedValue).toBe('enc_existing');
    expect(encryptValue).toHaveBeenCalledWith('plain-secret');
    expect(encryptedValue).toBe('enc_plain$iv$tag');
    expect(logger.info).toHaveBeenCalledWith('[AUDIT] Sidecar API key updated', { action: 'set' });
  });

  test('normalizeImageEmbeddingConfigState normalizes legacy values in place', () => {
    const config = {
      image_embedding_provider_mode: 'same',
      image_embedding_local_host: '',
      image_embedding_local_port: 11434,
    };

    const normalizedConfig = normalizeImageEmbeddingConfigState({ config });

    expect(normalizedConfig).toBe(config);
    expect(config.image_embedding_provider_mode).toBe('disabled');
    expect(config.image_embedding_local_port).toBe(8000);
  });

  test('maskAiSettingsSecretFields masks stored keys and decrypts the image sidecar key', () => {
    const config = {
      api_key: 'live-ai-key',
      embedding_cloud_api_key: 'live-embedding-key',
      image_embedding_cloud_api_key: 'live-image-key',
      image_embedding_local_api_key: 'enc_local$iv$tag',
    };

    const maskedConfig = maskAiSettingsSecretFields({
      config,
      parseEncryptedValue: jest.fn(() => ({ encrypted: 'enc_local', iv: 'iv', authTag: 'tag' })),
      decryptValue: jest.fn(() => 'local-plaintext'),
    });

    expect(maskedConfig).toBe(config);
    expect(config.api_key).toBe(maskToken('live-ai-key'));
    expect(config.embedding_cloud_api_key).toBe(maskToken('live-embedding-key'));
    expect(config.image_embedding_cloud_api_key).toBe(maskToken('live-image-key'));
    expect(config.image_embedding_local_api_key).toBe(maskToken('local-plaintext'));
  });

  test('maskAiSettingsSecretFields clears invalid encrypted sidecar key values', () => {
    const config = {
      image_embedding_local_api_key: 'bad-value',
    };

    maskAiSettingsSecretFields({
      config,
      parseEncryptedValue: jest.fn(() => {
        throw new Error('bad encrypted value');
      }),
      decryptValue: jest.fn(),
    });

    expect(config.image_embedding_local_api_key).toBeNull();
  });
});