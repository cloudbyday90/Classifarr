/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const LEGACY_EMBEDDING_DEFAULT_MODELS = Object.freeze({
  ollama: 'nomic-embed-text-v2-moe',
  openai: 'text-embedding-3-small',
  gemini: 'text-embedding-005',
  openrouter: 'text-embedding-3-small',
  litellm: 'text-embedding-3-small',
});

const CLOUD_EMBEDDING_DEFAULT_MODELS = Object.freeze({
  openai: 'text-embedding-3-small',
  gemini: 'text-embedding-004',
  voyage: 'voyage-2',
  openrouter: 'openai/text-embedding-3-small',
  cohere: 'embed-english-v3.0',
});

export function getDefaultAiSettingsConfig(getRagLoopDefaultConfig, overrides = {}) {
  return {
    primary_provider: 'none',
    api_endpoint: '',
    api_key: '',
    model: '',
    temperature: 0.7,
    max_tokens: 2000,
    monthly_budget_usd: null,
    current_month_usage_usd: 0,
    budget_alert_threshold: 80,
    pause_on_budget_exhausted: true,
    ollama_fallback_enabled: false,
    ollama_for_basic_tasks: false,
    ollama_for_budget_exhausted: true,
    ollama_host: 'localhost',
    ollama_port: 11434,
    ollama_model: 'llama3.2',
    rag_enabled: false,
    embedding_provider: 'auto',
    embedding_model: '',
    rag_similarity_threshold: 0.70,
    rag_text_weight: 0.70,
    rag_image_weight: 0.30,
    rag_min_history_count: 50,
    rag_backfill_budget_type: 'percentage',
    rag_backfill_budget_value: 25,
    pattern_mining_enabled: true,
    pattern_rule_priority: 'rules_first',
    pattern_ai_skip_threshold: 90,
    pattern_notification_dismissed: false,
    formula_pattern_weight: 0.40,
    formula_rule_weight: 0.30,
    formula_rag_weight: 0.20,
    formula_history_weight: 0.10,
    embedding_provider_mode: 'same',
    embedding_ollama_host: '',
    embedding_ollama_port: 11434,
    embedding_ollama_model: '',
    embedding_cloud_provider: '',
    embedding_cloud_api_key: '',
    embedding_cloud_model: '',
    image_embedding_provider_mode: 'disabled',
    image_embedding_local_host: '',
    image_embedding_local_port: 8000,
    image_embedding_local_model: '',
    image_embedding_cloud_provider: '',
    image_embedding_cloud_api_key: '',
    image_embedding_cloud_model: '',
    image_embedding_cloud_api_endpoint: '',
    image_embedding_image_size: 512,
    image_embedding_rps: 2,
    image_embedding_concurrency: 2,
    image_embedding_batch_size: 1,
    image_embedding_cache_ttl_hours: 24,
    image_embedding_cache_max_mb: 1024,
    image_embedding_models_cache: null,
    image_embedding_models_cache_updated_at: null,
    rag_graph_enabled: false,
    rag_graph_weight: 0.20,
    rag_graph_collection_enabled: true,
    rag_graph_director_enabled: true,
    rag_graph_studio_enabled: false,
    rag_graph_cast_enabled: false,
    rag_graph_genre_enabled: false,
    rag_graph_min_matches_to_apply: 1,
    rag_graph_candidates_limit: 20,
    ...getRagLoopDefaultConfig(),
    ...overrides,
  };
}

export function resolveEffectiveTextEmbeddingIdentity(config = {}) {
  const mode = config.embedding_provider_mode || 'same';

  if (mode === 'same') {
    let provider = config.embedding_provider;
    if (provider === 'auto') {
      provider = config.primary_provider;
    }

    return {
      mode,
      provider: provider || null,
      model: config.embedding_model || LEGACY_EMBEDDING_DEFAULT_MODELS[provider] || LEGACY_EMBEDDING_DEFAULT_MODELS.ollama,
    };
  }

  if (mode === 'separate_ollama') {
    return {
      mode,
      provider: 'ollama',
      model: config.embedding_ollama_model || LEGACY_EMBEDDING_DEFAULT_MODELS.ollama,
    };
  }

  if (mode === 'cloud') {
    const provider = config.embedding_cloud_provider || null;
    return {
      mode,
      provider,
      model: config.embedding_cloud_model || CLOUD_EMBEDDING_DEFAULT_MODELS[provider] || null,
    };
  }

  return {
    mode,
    provider: null,
    model: null,
  };
}

export function hasTextEmbeddingIdentityChanged(previousConfig = {}, nextConfig = {}) {
  const previous = resolveEffectiveTextEmbeddingIdentity(previousConfig);
  const next = resolveEffectiveTextEmbeddingIdentity(nextConfig);

  return (
    previous.mode !== next.mode ||
    previous.provider !== next.provider ||
    previous.model !== next.model
  );
}

export function normalizeImageEmbeddingMode(mode) {
  const rawMode = String(mode || '').toLowerCase();

  if (rawMode === 'local') {
    return 'separate_local';
  }
  if (['disabled', 'separate_local', 'cloud'].includes(rawMode)) {
    return rawMode;
  }
  return 'disabled';
}

export function normalizeImageEmbeddingLocalPort({ mode, host, port }) {
  const normalizedMode = normalizeImageEmbeddingMode(mode);
  const hasHost = typeof host === 'string' && host.trim().length > 0;
  const numericPort = Number(port);

  if (!Number.isInteger(numericPort) || numericPort <= 0) {
    return 8000;
  }

  if (!hasHost && normalizedMode === 'disabled' && numericPort === 11434) {
    return 8000;
  }

  return numericPort;
}

export const AI_SETTINGS_ALLOWED_KEYS = Object.freeze([
  'primary_provider',
  'api_endpoint',
  'api_key',
  'model',
  'temperature',
  'max_tokens',
  'monthly_budget_usd',
  'budget_alert_threshold',
  'pause_on_budget_exhausted',
  'ollama_fallback_enabled',
  'ollama_for_basic_tasks',
  'ollama_for_budget_exhausted',
  'ollama_host',
  'ollama_port',
  'ollama_model',
  'rag_enabled',
  'embedding_provider',
  'embedding_model',
  'rag_similarity_threshold',
  'rag_text_weight',
  'rag_image_weight',
  'rag_min_history_count',
  'rag_backfill_budget_type',
  'rag_backfill_budget_value',
  'formula_pattern_weight',
  'formula_rule_weight',
  'formula_rag_weight',
  'formula_history_weight',
  'embedding_provider_mode',
  'embedding_ollama_host',
  'embedding_ollama_port',
  'embedding_ollama_model',
  'embedding_cloud_provider',
  'embedding_cloud_api_key',
  'embedding_cloud_model',
  'image_embedding_provider_mode',
  'image_embedding_local_host',
  'image_embedding_local_port',
  'image_embedding_local_model',
  'image_embedding_cloud_provider',
  'image_embedding_cloud_api_key',
  'image_embedding_cloud_model',
  'image_embedding_cloud_api_endpoint',
  'image_embedding_image_size',
  'image_embedding_rps',
  'image_embedding_concurrency',
  'image_embedding_batch_size',
  'image_embedding_cache_ttl_hours',
  'image_embedding_cache_max_mb',
  'image_embedding_local_api_key',
  'image_embedding_local_timeout_ms',
  'rag_graph_enabled',
  'rag_graph_weight',
  'rag_graph_collection_enabled',
  'rag_graph_director_enabled',
  'rag_graph_studio_enabled',
  'rag_graph_cast_enabled',
  'rag_graph_genre_enabled',
  'rag_graph_min_matches_to_apply',
  'rag_graph_candidates_limit',
]);

export function validateAiSettingsPayloadKeys(rawConfig = {}, ragLoopDefaults = {}) {
  const allowedKeys = new Set([
    ...AI_SETTINGS_ALLOWED_KEYS,
    ...Object.keys(ragLoopDefaults || {}),
  ]);

  const unknownKeys = Object.keys(rawConfig || {}).filter((key) => !allowedKeys.has(key));

  return {
    unknownKeys,
    valid: unknownKeys.length === 0,
  };
}

