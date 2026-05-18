/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  AiEmbeddingProviderIntegrityService,
  buildAiRuntimeDedupeKey,
  buildEmbeddingRuntimeDedupeKey,
} from '../services/aiEmbeddingProviderIntegrityService.mjs';
import { createMockDb, createMockLogger } from './helpers/mockFactory.mjs';

describe('AiEmbeddingProviderIntegrityService', () => {
  test('builds dedupe keys for AI and embedding runtime drift', () => {
    expect(buildAiRuntimeDedupeKey('availability_check_failed', 'ETIMEDOUT provider down')).toBe(
      'ai-provider-runtime:availability_check_failed:etimedout_provider_down'
    );

    expect(buildEmbeddingRuntimeDedupeKey('image', 'auth_fail', 'localhost:8000:401')).toBe(
      'embedding-provider-runtime:image:auth_fail:localhost:8000:401'
    );
  });

  test('auditPersistedConfigs warns once when AI and embedding config drift exists', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    db.query.mockResolvedValueOnce({
      rows: [{
        rag_enabled: true,
        primary_provider: 'custom',
        api_key: '',
        api_endpoint: '',
        embedding_provider_mode: 'cloud',
        embedding_cloud_provider: '',
        embedding_cloud_api_key: '',
        embedding_ollama_host: '',
        rag_image_weight: 0.35,
        image_embedding_provider_mode: 'separate_local',
        image_embedding_cloud_provider: '',
        image_embedding_cloud_api_key: '',
        image_embedding_local_host: '',
      }],
    });

    const service = new AiEmbeddingProviderIntegrityService({ db, logger, startupSampleLimit: 10 });
    const result = await service.auditPersistedConfigs({ source: 'startup_preflight' });

    expect(result.invalidIssueCount).toBeGreaterThan(0);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ area: 'ai', issue: 'missing_primary_provider_api_key' }),
      expect.objectContaining({ area: 'ai', issue: 'missing_primary_provider_api_endpoint' }),
      expect.objectContaining({ area: 'text_embedding', issue: 'missing_cloud_provider' }),
      expect.objectContaining({ area: 'text_embedding', issue: 'missing_cloud_api_key' }),
      expect.objectContaining({ area: 'image_embedding', issue: 'missing_local_host' }),
    ]));
    expect(logger.warn).toHaveBeenCalledWith(
      'Persisted AI and embedding provider configuration drift detected; provider fallbacks may warn once and degrade conservatively',
      expect.objectContaining({
        source: 'startup_preflight',
        invalidIssueCount: result.invalidIssueCount,
      }),
      expect.objectContaining({
        dedupeKey: 'persisted-ai-embedding-provider-config-drift',
      })
    );
  });

  test('auditPersistedConfigs stays quiet when persisted config is valid', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    db.query.mockResolvedValueOnce({
      rows: [{
        rag_enabled: true,
        primary_provider: 'openai',
        api_key: 'live-key',
        api_endpoint: 'https://api.openai.com/v1',
        embedding_provider_mode: 'same',
        embedding_cloud_provider: '',
        embedding_cloud_api_key: '',
        embedding_ollama_host: '',
        rag_image_weight: 0,
        image_embedding_provider_mode: 'disabled',
        image_embedding_cloud_provider: '',
        image_embedding_cloud_api_key: '',
        image_embedding_local_host: '',
      }],
    });

    const service = new AiEmbeddingProviderIntegrityService({ db, logger });
    const result = await service.auditPersistedConfigs({ source: 'startup_preflight' });

    expect(result).toEqual({ invalidIssueCount: 0, issues: [] });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
