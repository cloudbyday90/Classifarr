/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  hasTextEmbeddingIdentityChanged,
  normalizeImageEmbeddingLocalPort,
  normalizeImageEmbeddingMode,
  resolveEffectiveTextEmbeddingIdentity,
} from './aiSettingsHelpers.mjs';
import {
  resolveStoredImageEmbeddingLocalApiKey,
  resolveStoredSecretValue,
} from './aiSettingsConfigSupport.mjs';

function validateFormulaWeights({
  existing,
  formula_pattern_weight,
  formula_rule_weight,
  formula_rag_weight,
  formula_history_weight,
}) {
  const providedWeights = [formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight];
  const hasWeights = providedWeights.some((weight) => weight !== undefined);

  if (!hasWeights) {
    return;
  }

  const currentWeights = existing || {};
  const finalPatternWeight = formula_pattern_weight ?? currentWeights.formula_pattern_weight ?? 0.40;
  const finalRuleWeight = formula_rule_weight ?? currentWeights.formula_rule_weight ?? 0.30;
  const finalRagWeight = formula_rag_weight ?? currentWeights.formula_rag_weight ?? 0.20;
  const finalHistoryWeight = formula_history_weight ?? currentWeights.formula_history_weight ?? 0.10;
  const sum = finalPatternWeight + finalRuleWeight + finalRagWeight + finalHistoryWeight;

  if (sum < 0.99 || sum > 1.01) {
    const error = new Error(`Formula weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust the weights so they total 100%.`);
    error.httpStatus = 400;
    error.currentSum = sum;
    throw error;
  }
}

function buildNextTextEmbeddingConfig({ body, existing }) {
  return {
    ...existing,
    primary_provider: body.primary_provider ?? existing.primary_provider ?? 'none',
    embedding_provider_mode: body.embedding_provider_mode ?? existing.embedding_provider_mode ?? 'same',
    embedding_provider: body.embedding_provider ?? existing.embedding_provider ?? 'auto',
    embedding_model: body.embedding_model ?? existing.embedding_model ?? '',
    embedding_ollama_model: body.embedding_ollama_model ?? existing.embedding_ollama_model ?? '',
    embedding_cloud_provider: body.embedding_cloud_provider ?? existing.embedding_cloud_provider ?? '',
    embedding_cloud_model: body.embedding_cloud_model ?? existing.embedding_cloud_model ?? '',
  };
}

async function clearEmbeddingsOnIdentityChange({ client, logger, existing, nextTextEmbeddingConfig }) {
  const previousEmbeddingIdentity = resolveEffectiveTextEmbeddingIdentity(existing);
  const nextEmbeddingIdentity = resolveEffectiveTextEmbeddingIdentity(nextTextEmbeddingConfig);
  const textEmbeddingIdentityChanged = hasTextEmbeddingIdentityChanged(existing, nextTextEmbeddingConfig);

  if (!textEmbeddingIdentityChanged) {
    return;
  }

  try {
    await client.query('DELETE FROM classification_embeddings');
    logger.warn('Text embedding identity changed - cleared existing embeddings', {
      oldMode: previousEmbeddingIdentity.mode,
      oldProvider: previousEmbeddingIdentity.provider,
      oldModel: previousEmbeddingIdentity.model,
      newMode: nextEmbeddingIdentity.mode,
      newProvider: nextEmbeddingIdentity.provider,
      newModel: nextEmbeddingIdentity.model,
    });
  } catch (error) {
    logger.error('Failed to clear embeddings after text embedding identity change', { error: error.message });
  }
}

async function updateNormalizedRagLoopConfig({ client, normalizedRagLoopConfig }) {
  const ragLoopKeys = Object.keys(normalizedRagLoopConfig);
  if (ragLoopKeys.length === 0) {
    return;
  }

  const ragAssignments = ragLoopKeys
    .map((key, index) => `${key} = $${index + 1}`)
    .join(', ');
  const ragValues = ragLoopKeys.map((key) => normalizedRagLoopConfig[key]);

  await client.query(`
        UPDATE ai_provider_config
        SET ${ragAssignments},
            updated_at = NOW()
        WHERE id = 1
      `, ragValues);
}

async function resetImageEmbeddingModelCache({ client, existing, config }) {
  const localConfigChanged = (
    (existing.image_embedding_local_host || '') !== (config.image_embedding_local_host || '') ||
    Number(existing.image_embedding_local_port || 8000) !== Number(config.image_embedding_local_port || 8000)
  );
  const cloudConfigChanged = (
    (existing.image_embedding_cloud_provider || '') !== (config.image_embedding_cloud_provider || '') ||
    (existing.image_embedding_cloud_api_endpoint || '') !== (config.image_embedding_cloud_api_endpoint || '')
  );

  if (!localConfigChanged && !cloudConfigChanged) {
    return config;
  }

  try {
    const currentCache = existing.image_embedding_models_cache || {};
    const nextCache = { ...currentCache };
    if (localConfigChanged) {
      delete nextCache.local;
    }
    if (cloudConfigChanged) {
      delete nextCache.cloud;
    }

    await client.query(`
            UPDATE ai_provider_config
            SET image_embedding_models_cache = $1,
                image_embedding_models_cache_updated_at = NOW()
            WHERE id = 1
          `, [nextCache]);
    config.image_embedding_models_cache = nextCache;
    config.image_embedding_models_cache_updated_at = new Date().toISOString();
  } catch (_cacheError) {
    // Best-effort cache reset; do not fail request
  }

  return config;
}

function buildAiProviderConfigUpsertValues({
  body,
  existing,
  finalApiKey,
  finalEmbeddingCloudApiKey,
  finalImageEmbeddingCloudApiKey,
  finalImageEmbeddingLocalApiKey,
  finalImageEmbeddingMode,
  finalImageEmbeddingLocalHost,
  finalImageEmbeddingLocalPort,
}) {
  return [
    body.primary_provider ?? existing.primary_provider ?? 'none',
    body.api_endpoint ?? existing.api_endpoint ?? '',
    finalApiKey || '',
    body.model ?? existing.model ?? '',
    body.temperature ?? existing.temperature ?? 0.7,
    body.max_tokens ?? existing.max_tokens ?? 2000,
    body.monthly_budget_usd ?? existing.monthly_budget_usd ?? null,
    body.budget_alert_threshold ?? existing.budget_alert_threshold ?? 80,
    body.pause_on_budget_exhausted ?? existing.pause_on_budget_exhausted ?? true,
    body.ollama_fallback_enabled ?? existing.ollama_fallback_enabled ?? false,
    body.ollama_for_basic_tasks ?? existing.ollama_for_basic_tasks ?? false,
    body.ollama_for_budget_exhausted ?? existing.ollama_for_budget_exhausted ?? true,
    body.ollama_host ?? existing.ollama_host ?? 'localhost',
    body.ollama_port ?? existing.ollama_port ?? 11434,
    body.ollama_model ?? existing.ollama_model ?? 'llama3.2',
    body.rag_enabled ?? existing.rag_enabled ?? false,
    body.embedding_provider ?? existing.embedding_provider ?? 'auto',
    body.embedding_model ?? existing.embedding_model ?? '',
    body.rag_similarity_threshold ?? existing.rag_similarity_threshold ?? 0.70,
    body.rag_text_weight ?? existing.rag_text_weight ?? 0.70,
    body.rag_image_weight ?? existing.rag_image_weight ?? 0.30,
    body.rag_min_history_count ?? existing.rag_min_history_count ?? 50,
    body.rag_backfill_budget_type ?? existing.rag_backfill_budget_type ?? 'percentage',
    body.rag_backfill_budget_value ?? existing.rag_backfill_budget_value ?? 25,
    body.formula_pattern_weight ?? existing.formula_pattern_weight ?? 0.40,
    body.formula_rule_weight ?? existing.formula_rule_weight ?? 0.30,
    body.formula_rag_weight ?? existing.formula_rag_weight ?? 0.20,
    body.formula_history_weight ?? existing.formula_history_weight ?? 0.10,
    body.embedding_provider_mode ?? existing.embedding_provider_mode ?? 'same',
    body.embedding_ollama_host ?? existing.embedding_ollama_host ?? '',
    body.embedding_ollama_port ?? existing.embedding_ollama_port ?? 11434,
    body.embedding_ollama_model ?? existing.embedding_ollama_model ?? '',
    body.embedding_cloud_provider ?? existing.embedding_cloud_provider ?? '',
    finalEmbeddingCloudApiKey || '',
    body.embedding_cloud_model ?? existing.embedding_cloud_model ?? '',
    finalImageEmbeddingMode,
    finalImageEmbeddingLocalHost,
    finalImageEmbeddingLocalPort,
    body.image_embedding_local_model ?? existing.image_embedding_local_model ?? '',
    body.image_embedding_cloud_provider ?? existing.image_embedding_cloud_provider ?? '',
    finalImageEmbeddingCloudApiKey || '',
    body.image_embedding_cloud_model ?? existing.image_embedding_cloud_model ?? '',
    body.image_embedding_cloud_api_endpoint ?? existing.image_embedding_cloud_api_endpoint ?? '',
    body.image_embedding_image_size ?? existing.image_embedding_image_size ?? 512,
    body.image_embedding_rps ?? existing.image_embedding_rps ?? 2,
    body.image_embedding_concurrency ?? existing.image_embedding_concurrency ?? 2,
    body.image_embedding_batch_size ?? existing.image_embedding_batch_size ?? 1,
    body.image_embedding_cache_ttl_hours ?? existing.image_embedding_cache_ttl_hours ?? 24,
    body.image_embedding_cache_max_mb ?? existing.image_embedding_cache_max_mb ?? 1024,
    body.rag_graph_enabled ?? existing.rag_graph_enabled ?? false,
    body.rag_graph_weight ?? existing.rag_graph_weight ?? 0.20,
    body.rag_graph_collection_enabled ?? existing.rag_graph_collection_enabled ?? true,
    body.rag_graph_director_enabled ?? existing.rag_graph_director_enabled ?? true,
    body.rag_graph_studio_enabled ?? existing.rag_graph_studio_enabled ?? false,
    body.rag_graph_cast_enabled ?? existing.rag_graph_cast_enabled ?? false,
    body.rag_graph_genre_enabled ?? existing.rag_graph_genre_enabled ?? false,
    body.rag_graph_min_matches_to_apply ?? existing.rag_graph_min_matches_to_apply ?? 1,
    body.rag_graph_candidates_limit ?? existing.rag_graph_candidates_limit ?? 20,
    finalImageEmbeddingLocalApiKey ?? null,
    body.image_embedding_local_timeout_ms ?? existing.image_embedding_local_timeout_ms ?? 15000,
  ];
}

export async function persistAiSettingsConfig({
  client,
  body = {},
  logger,
  validateAndNormalizeRagLoopConfig,
  encryptValue,
  formatEncryptedValue,
}) {
  const existingResult = await client.query('SELECT * FROM ai_provider_config WHERE id = 1');
  const existing = existingResult.rows[0] || {};

  const { normalizedConfig: normalizedRagLoopConfig, warnings: ragLoopWarnings } =
    validateAndNormalizeRagLoopConfig(body, existing);

  if (ragLoopWarnings.length > 0) {
    logger.warn('RAG loop config values normalized to safe bounds/defaults', {
      warnings: ragLoopWarnings,
    });
  }

  const finalApiKey = resolveStoredSecretValue(body.api_key, existing.api_key);
  const finalEmbeddingCloudApiKey = resolveStoredSecretValue(
    body.embedding_cloud_api_key,
    existing.embedding_cloud_api_key,
  );
  const finalImageEmbeddingCloudApiKey = resolveStoredSecretValue(
    body.image_embedding_cloud_api_key,
    existing.image_embedding_cloud_api_key,
  );
  const finalImageEmbeddingLocalApiKey = resolveStoredImageEmbeddingLocalApiKey({
    submittedValue: body.image_embedding_local_api_key,
    existingValue: existing.image_embedding_local_api_key,
    encryptValue,
    formatEncryptedValue,
    logger,
  });

  const normalizedExistingImageEmbeddingMode = normalizeImageEmbeddingMode(existing.image_embedding_provider_mode);
  const normalizedRequestedImageEmbeddingMode = body.image_embedding_provider_mode === undefined
    ? undefined
    : normalizeImageEmbeddingMode(body.image_embedding_provider_mode);
  const finalImageEmbeddingMode = normalizedRequestedImageEmbeddingMode ?? normalizedExistingImageEmbeddingMode;
  const finalImageEmbeddingLocalHost = body.image_embedding_local_host ?? existing.image_embedding_local_host ?? '';
  const finalImageEmbeddingLocalPort = body.image_embedding_local_port !== undefined
    ? normalizeImageEmbeddingLocalPort({
      mode: finalImageEmbeddingMode,
      host: finalImageEmbeddingLocalHost,
      port: body.image_embedding_local_port,
    })
    : normalizeImageEmbeddingLocalPort({
      mode: finalImageEmbeddingMode,
      host: finalImageEmbeddingLocalHost,
      port: existing.image_embedding_local_port,
    });

  const nextTextEmbeddingConfig = buildNextTextEmbeddingConfig({ body, existing });
  await clearEmbeddingsOnIdentityChange({
    client,
    logger,
    existing,
    nextTextEmbeddingConfig,
  });

  validateFormulaWeights({
    existing,
    formula_pattern_weight: body.formula_pattern_weight,
    formula_rule_weight: body.formula_rule_weight,
    formula_rag_weight: body.formula_rag_weight,
    formula_history_weight: body.formula_history_weight,
  });

  await client.query(`
            INSERT INTO ai_provider_config (
                id, primary_provider, api_endpoint, api_key, model, temperature, max_tokens,
                monthly_budget_usd, budget_alert_threshold, pause_on_budget_exhausted,
                ollama_fallback_enabled, ollama_for_basic_tasks, ollama_for_budget_exhausted,
                ollama_host, ollama_port, ollama_model,
                rag_enabled, embedding_provider, embedding_model,
                rag_similarity_threshold, rag_text_weight, rag_image_weight, rag_min_history_count,
                rag_backfill_budget_type, rag_backfill_budget_value,
                formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight,
                embedding_provider_mode, embedding_ollama_host, embedding_ollama_port, embedding_ollama_model,
                embedding_cloud_provider, embedding_cloud_api_key, embedding_cloud_model,
                image_embedding_provider_mode, image_embedding_local_host, image_embedding_local_port, image_embedding_local_model,
                image_embedding_cloud_provider, image_embedding_cloud_api_key, image_embedding_cloud_model,
                image_embedding_cloud_api_endpoint,
                image_embedding_image_size, image_embedding_rps, image_embedding_concurrency, image_embedding_batch_size,
                image_embedding_cache_ttl_hours, image_embedding_cache_max_mb,
                rag_graph_enabled, rag_graph_weight,
                rag_graph_collection_enabled, rag_graph_director_enabled, rag_graph_studio_enabled,
                rag_graph_cast_enabled, rag_graph_genre_enabled,
                rag_graph_min_matches_to_apply, rag_graph_candidates_limit,
                image_embedding_local_api_key, image_embedding_local_timeout_ms,
                updated_at
            ) VALUES (
                1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49,
                $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                primary_provider = EXCLUDED.primary_provider,
                api_endpoint = EXCLUDED.api_endpoint,
                api_key = EXCLUDED.api_key,
                model = EXCLUDED.model,
                temperature = EXCLUDED.temperature,
                max_tokens = EXCLUDED.max_tokens,
                monthly_budget_usd = EXCLUDED.monthly_budget_usd,
                budget_alert_threshold = EXCLUDED.budget_alert_threshold,
                pause_on_budget_exhausted = EXCLUDED.pause_on_budget_exhausted,
                ollama_fallback_enabled = EXCLUDED.ollama_fallback_enabled,
                ollama_for_basic_tasks = EXCLUDED.ollama_for_basic_tasks,
                ollama_for_budget_exhausted = EXCLUDED.ollama_for_budget_exhausted,
                ollama_host = EXCLUDED.ollama_host,
                ollama_port = EXCLUDED.ollama_port,
                ollama_model = EXCLUDED.ollama_model,
                rag_enabled = EXCLUDED.rag_enabled,
                embedding_provider = EXCLUDED.embedding_provider,
                embedding_model = EXCLUDED.embedding_model,
                rag_similarity_threshold = EXCLUDED.rag_similarity_threshold,
                rag_text_weight = EXCLUDED.rag_text_weight,
                rag_image_weight = EXCLUDED.rag_image_weight,
                rag_min_history_count = EXCLUDED.rag_min_history_count,
                rag_backfill_budget_type = EXCLUDED.rag_backfill_budget_type,
                rag_backfill_budget_value = EXCLUDED.rag_backfill_budget_value,
                formula_pattern_weight = EXCLUDED.formula_pattern_weight,
                formula_rule_weight = EXCLUDED.formula_rule_weight,
                formula_rag_weight = EXCLUDED.formula_rag_weight,
                formula_history_weight = EXCLUDED.formula_history_weight,
                embedding_provider_mode = EXCLUDED.embedding_provider_mode,
                embedding_ollama_host = EXCLUDED.embedding_ollama_host,
                embedding_ollama_port = EXCLUDED.embedding_ollama_port,
                embedding_ollama_model = EXCLUDED.embedding_ollama_model,
                embedding_cloud_provider = EXCLUDED.embedding_cloud_provider,
                embedding_cloud_api_key = EXCLUDED.embedding_cloud_api_key,
                embedding_cloud_model = EXCLUDED.embedding_cloud_model,
                image_embedding_provider_mode = EXCLUDED.image_embedding_provider_mode,
                image_embedding_local_host = EXCLUDED.image_embedding_local_host,
                image_embedding_local_port = EXCLUDED.image_embedding_local_port,
                image_embedding_local_model = EXCLUDED.image_embedding_local_model,
                image_embedding_cloud_provider = EXCLUDED.image_embedding_cloud_provider,
                image_embedding_cloud_api_key = EXCLUDED.image_embedding_cloud_api_key,
                image_embedding_cloud_model = EXCLUDED.image_embedding_cloud_model,
                image_embedding_cloud_api_endpoint = EXCLUDED.image_embedding_cloud_api_endpoint,
                image_embedding_image_size = EXCLUDED.image_embedding_image_size,
                image_embedding_rps = EXCLUDED.image_embedding_rps,
                image_embedding_concurrency = EXCLUDED.image_embedding_concurrency,
                image_embedding_batch_size = EXCLUDED.image_embedding_batch_size,
                image_embedding_cache_ttl_hours = EXCLUDED.image_embedding_cache_ttl_hours,
                image_embedding_cache_max_mb = EXCLUDED.image_embedding_cache_max_mb,
                rag_graph_enabled = EXCLUDED.rag_graph_enabled,
                rag_graph_weight = EXCLUDED.rag_graph_weight,
                rag_graph_collection_enabled = EXCLUDED.rag_graph_collection_enabled,
                rag_graph_director_enabled = EXCLUDED.rag_graph_director_enabled,
                rag_graph_studio_enabled = EXCLUDED.rag_graph_studio_enabled,
                rag_graph_cast_enabled = EXCLUDED.rag_graph_cast_enabled,
                rag_graph_genre_enabled = EXCLUDED.rag_graph_genre_enabled,
                rag_graph_min_matches_to_apply = EXCLUDED.rag_graph_min_matches_to_apply,
                rag_graph_candidates_limit = EXCLUDED.rag_graph_candidates_limit,
                image_embedding_local_api_key = EXCLUDED.image_embedding_local_api_key,
                image_embedding_local_timeout_ms = EXCLUDED.image_embedding_local_timeout_ms,
                updated_at = NOW()
        `, buildAiProviderConfigUpsertValues({
    body,
    existing,
    finalApiKey,
    finalEmbeddingCloudApiKey,
    finalImageEmbeddingCloudApiKey,
    finalImageEmbeddingLocalApiKey,
    finalImageEmbeddingMode,
    finalImageEmbeddingLocalHost,
    finalImageEmbeddingLocalPort,
  }));

  await updateNormalizedRagLoopConfig({
    client,
    normalizedRagLoopConfig,
  });

  const latestResult = await client.query('SELECT * FROM ai_provider_config WHERE id = 1');
  const config = latestResult.rows[0];

  return resetImageEmbeddingModelCache({
    client,
    existing,
    config,
  });
}
