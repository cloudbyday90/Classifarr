/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { maskToken } from '../utils/tokenMasking.mjs';
import { persistAiSettingsConfig } from '../routes/helpers/aiSettingsPersistence.mjs';

describe('persistAiSettingsConfig', () => {
  test('preserves stored masked keys, updates rag config, and invalidates changed image model caches', async () => {
    const existing = {
      id: 1,
      api_key: 'stored-ai-key',
      embedding_cloud_api_key: 'stored-embedding-key',
      image_embedding_cloud_api_key: 'stored-image-key',
      image_embedding_provider_mode: 'cloud',
      image_embedding_local_host: 'old-host',
      image_embedding_local_port: 8000,
      image_embedding_cloud_provider: 'old-provider',
      image_embedding_cloud_api_endpoint: 'https://old.example.test',
      image_embedding_models_cache: {
        local: ['local-model'],
        cloud: ['cloud-model'],
      },
    };
    const latest = {
      ...existing,
      image_embedding_provider_mode: 'separate_local',
      image_embedding_local_host: 'new-host',
      image_embedding_local_port: 9000,
      image_embedding_cloud_provider: 'new-provider',
      image_embedding_cloud_api_endpoint: 'https://new.example.test',
    };

    let selectCount = 0;
    let insertParams;
    let ragUpdateParams;
    let cacheUpdateParams;
    const client = {
      query: jest.fn(async (sql, params) => {
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1 FOR UPDATE'
          || sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          selectCount += 1;
          return { rows: [selectCount === 1 ? existing : latest] };
        }

        if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
          insertParams = params;
          return { rows: [] };
        }

        if (typeof sql === 'string' && sql.includes('SET rag_loop_enabled = $1')) {
          ragUpdateParams = params;
          return { rows: [] };
        }

        if (typeof sql === 'string' && sql.includes('image_embedding_models_cache = $1')) {
          cacheUpdateParams = params;
          return { rows: [] };
        }

        return { rows: [] };
      }),
    };
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    const result = await persistAiSettingsConfig({
      client,
      body: {
        api_key: maskToken('stored-ai-key'),
        embedding_cloud_api_key: maskToken('stored-embedding-key'),
        image_embedding_cloud_api_key: maskToken('stored-image-key'),
        image_embedding_provider_mode: 'local',
        image_embedding_local_host: 'new-host',
        image_embedding_local_port: 9000,
        image_embedding_cloud_provider: 'new-provider',
        image_embedding_cloud_api_endpoint: 'https://new.example.test',
      },
      logger,
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({
        normalizedConfig: { rag_loop_enabled: true },
        warnings: [],
      })),
      encryptValue: jest.fn(),
      formatEncryptedValue: jest.fn(),
    });

    expect(insertParams[2]).toBe('stored-ai-key');
    expect(insertParams[33]).toBe('stored-embedding-key');
    expect(insertParams[35]).toBe('separate_local');
    expect(insertParams[36]).toBe('new-host');
    expect(insertParams[37]).toBe(9000);
    expect(insertParams[40]).toBe('stored-image-key');
    expect(ragUpdateParams).toEqual([true]);
    expect(cacheUpdateParams).toEqual([{}]);
    expect(result.config.image_embedding_models_cache).toEqual({});
    expect(typeof result.config.image_embedding_models_cache_updated_at).toBe('string');
    expect(result.effects).toEqual({ textEmbeddingsCleared: true });
  });

  test('rejects invalid formula weights before attempting the upsert', async () => {
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1 FOR UPDATE'
          || sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          return { rows: [{}] };
        }

        return { rows: [] };
      }),
    };

    await expect(persistAiSettingsConfig({
      client,
      body: {
        formula_pattern_weight: 0.5,
        formula_rule_weight: 0.5,
        formula_rag_weight: 0.5,
        formula_history_weight: 0.2,
      },
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({
        normalizedConfig: {},
        warnings: [],
      })),
      encryptValue: jest.fn(),
      formatEncryptedValue: jest.fn(),
    })).rejects.toMatchObject({
      httpStatus: 400,
      currentSum: 1.7,
    });

    expect(
      client.query.mock.calls.some(
        ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config'),
      ),
    ).toBe(false);
  });

  test('clears existing embeddings when the text embedding identity changes', async () => {
    const existing = {
      id: 1,
      primary_provider: 'openai',
      embedding_provider_mode: 'same',
      embedding_provider: 'auto',
      embedding_model: '',
    };
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1 FOR UPDATE'
          || sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          return { rows: [existing] };
        }

        return { rows: [] };
      }),
    };
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    const result = await persistAiSettingsConfig({
      client,
      body: {
        embedding_provider_mode: 'cloud',
        embedding_cloud_provider: 'voyage',
        embedding_cloud_model: 'voyage-2',
      },
      logger,
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({
        normalizedConfig: {},
        warnings: [],
      })),
      encryptValue: jest.fn(),
      formatEncryptedValue: jest.fn(),
    });

    expect(client.query).toHaveBeenCalledWith('DELETE FROM classification_embeddings');
    expect(result.effects).toEqual({ textEmbeddingsCleared: true });
    expect(client.query).toHaveBeenCalledWith(
      'INSERT INTO rag_logs (level, type, message) VALUES ($1, $2, $3)',
      [
        'warning',
        'settings',
        expect.stringContaining('Text embedding identity changed from'),
      ],
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Text embedding identity changed - cleared existing embeddings',
      expect.objectContaining({
        oldMode: 'same',
        newMode: 'cloud',
        newProvider: 'voyage',
        newModel: 'voyage-2',
      }),
    );
  });

  test('continues when the RAG embedding-clear audit log insert fails', async () => {
    const existing = {
      id: 1,
      primary_provider: 'openai',
      embedding_provider_mode: 'same',
      embedding_provider: 'auto',
      embedding_model: '',
    };
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1 FOR UPDATE'
          || sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          return { rows: [existing] };
        }
        if (sql === 'INSERT INTO rag_logs (level, type, message) VALUES ($1, $2, $3)') {
          throw new Error('rag audit unavailable');
        }

        return { rows: [] };
      }),
    };
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    await expect(persistAiSettingsConfig({
      client,
      body: {
        embedding_provider_mode: 'cloud',
        embedding_cloud_provider: 'voyage',
        embedding_cloud_model: 'voyage-2',
      },
      logger,
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({
        normalizedConfig: {},
        warnings: [],
      })),
      encryptValue: jest.fn(),
      formatEncryptedValue: jest.fn(),
    })).resolves.toBeTruthy();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to persist RAG embedding-clear audit log',
      { error: 'rag audit unavailable' },
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Text embedding identity changed - cleared existing embeddings',
      expect.any(Object),
    );
  });

  test('uses safe defaults when no existing config row exists yet', async () => {
    let selectCount = 0;
    let insertParams;
    const latest = {
      id: 1,
      primary_provider: 'none',
      api_endpoint: '',
      api_key: '',
      image_embedding_provider_mode: 'disabled',
      image_embedding_local_host: '',
      image_embedding_local_port: 8000,
    };

    const client = {
      query: jest.fn(async (sql, params) => {
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1 FOR UPDATE'
          || sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          selectCount += 1;
          return { rows: selectCount === 1 ? [] : [latest] };
        }

        if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
          insertParams = params;
        }

        return { rows: [] };
      }),
    };

    const result = await persistAiSettingsConfig({
      client,
      body: {},
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({
        normalizedConfig: {},
        warnings: [],
      })),
      encryptValue: jest.fn(),
      formatEncryptedValue: jest.fn(),
    });

    expect(insertParams[0]).toBe('none');
    expect(insertParams[1]).toBe('');
    expect(insertParams[2]).toBe('');
    expect(insertParams[35]).toBe('disabled');
    expect(insertParams[36]).toBe('');
    expect(insertParams[37]).toBe(8000);
    expect(result.config).toEqual(latest);
    expect(result.effects).toEqual({ textEmbeddingsCleared: true });
  });

  test('persists an in-transaction receipt only when the saved capability status changes', async () => {
    const existing = { id: 1, primary_provider: 'none', configuration_revision: '11' };
    const latest = {
      ...existing,
      primary_provider: 'gemini',
      model: 'gemini-2.5-pro',
      configuration_revision: '12',
    };
    let selectCount = 0;
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1 FOR UPDATE'
          || sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          selectCount += 1;
          return { rows: [selectCount === 1 ? existing : latest] };
        }
        return { rows: [] };
      }),
    };
    const receiptRepository = { record: jest.fn().mockResolvedValue({ id: '15' }) };

    await persistAiSettingsConfig({
      client,
      body: { primary_provider: 'gemini', model: 'gemini-2.5-pro' },
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      encryptValue: jest.fn(),
      formatEncryptedValue: jest.fn(),
      verificationCapabilityChangeReceiptRepository: receiptRepository,
      verificationCapabilityChangeReceiptActorId: 'user:42',
    });

    expect(receiptRepository.record).toHaveBeenCalledWith({
      client,
      receipt: expect.objectContaining({
        actorId: 'user:42',
        beforeStatusId: 'primary_path_ineligible',
        afterStatusId: 'verification_ready',
        configurationRevision: 12,
      }),
    });
  });

  test('propagates receipt persistence failure so the caller-owned configuration transaction can roll back', async () => {
    const existing = { id: 1, primary_provider: 'none', configuration_revision: 0 };
    const latest = {
      ...existing,
      primary_provider: 'gemini',
      model: 'gemini-2.5-pro',
      configuration_revision: '1',
    };
    let selectCount = 0;
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1 FOR UPDATE'
          || sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          selectCount += 1;
          return { rows: [selectCount === 1 ? existing : latest] };
        }
        return { rows: [] };
      }),
    };

    await expect(persistAiSettingsConfig({
      client,
      body: { primary_provider: 'gemini', model: 'gemini-2.5-pro' },
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      encryptValue: jest.fn(),
      formatEncryptedValue: jest.fn(),
      verificationCapabilityChangeReceiptRepository: {
        record: jest.fn().mockRejectedValue(new Error('receipt insert failed')),
      },
      verificationCapabilityChangeReceiptActorId: 'user:42',
    })).rejects.toThrow('receipt insert failed');
  });
});
