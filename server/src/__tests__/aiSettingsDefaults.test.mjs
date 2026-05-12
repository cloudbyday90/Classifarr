/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import { getDefaultAiSettingsConfig } from '../services/shared/aiSettingsDefaults.mjs';

describe('aiSettingsDefaults', () => {
  test('getDefaultAiSettingsConfig returns the stable AI default shape and keeps text/image embedding defaults separate', () => {
    const defaults = getDefaultAiSettingsConfig(() => ({
      rag_loop_enabled: true,
      rag_loop_max_steps: 4,
    }));

    expect(defaults).toMatchObject({
      primary_provider: 'none',
      api_endpoint: '',
      api_key: '',
      embedding_provider_mode: 'same',
      image_embedding_provider_mode: 'disabled',
      embedding_cloud_api_key: '',
      image_embedding_cloud_api_key: '',
      image_embedding_local_port: 8000,
      rag_graph_enabled: false,
      rag_loop_enabled: true,
      rag_loop_max_steps: 4,
    });
  });

  test('getDefaultAiSettingsConfig applies overrides after base defaults and rag defaults', () => {
    const defaults = getDefaultAiSettingsConfig(
      () => ({
        rag_graph_enabled: true,
        rag_loop_enabled: true,
      }),
      {
        rag_graph_enabled: false,
        primary_provider: 'openai',
        image_embedding_provider_mode: 'cloud',
      },
    );

    expect(defaults).toMatchObject({
      primary_provider: 'openai',
      rag_graph_enabled: false,
      rag_loop_enabled: true,
      image_embedding_provider_mode: 'cloud',
    });
  });
});
