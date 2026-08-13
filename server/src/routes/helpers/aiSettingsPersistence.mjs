/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  normalizeImageEmbeddingLocalPort,
  normalizeImageEmbeddingMode,
} from './aiSettingsHelpers.mjs';
import {
  resolveStoredImageEmbeddingLocalApiKey,
  resolveStoredSecretValue,
} from './aiSettingsConfigSupport.mjs';
import {
  validateFormulaWeights,
  buildNextTextEmbeddingConfig,
  buildAiProviderConfigUpsertValues,
} from './aiSettingsPersistenceConfig.mjs';
import {
  clearEmbeddingsOnIdentityChange,
  updateNormalizedRagLoopConfig,
  resetImageEmbeddingModelCache,
} from './aiSettingsPersistenceEffects.mjs';
import {
  buildCandidateBoundVerificationCapabilityChangeReceipt,
} from '../../services/classificationCandidateBoundVerificationCapabilityChangeReceipt.mjs';

/** @typedef {Record<string, any>} AiSettingsPersistenceConfig */

function getNextConfigurationRevision(existing) {
  const currentRevision = Number(existing?.configuration_revision);
  return Number.isSafeInteger(currentRevision) && currentRevision >= 0
    ? currentRevision + 1
    : 1;
}

/**
 * PostgreSQL returns BIGINT values as strings by default. Keep the persisted
 * value opaque to the settings response, but normalize it for the receipt
 * contract. The fallback also keeps a pre-migration in-memory test row safe.
 */
function resolvePersistedConfigurationRevision({ existing, persistedConfig }) {
  const persistedRevision = Number(persistedConfig?.configuration_revision);
  if (Number.isSafeInteger(persistedRevision) && persistedRevision > 0) {
    return persistedRevision;
  }

  const nextRevision = getNextConfigurationRevision(existing);
  persistedConfig.configuration_revision = nextRevision;
  return nextRevision;
}

/**
 * @param {{
 *   client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
 *   body?: AiSettingsPersistenceConfig,
 *   logger: { warn: (msg: string, p?: Record<string, unknown>) => void, error: (msg: string, p?: Record<string, unknown>) => void, info: (msg: string, p?: Record<string, unknown>) => void },
 *   validateAndNormalizeRagLoopConfig: (body: AiSettingsPersistenceConfig, existing: AiSettingsPersistenceConfig) => { normalizedConfig: Record<string, any>, warnings: string[] },
 *   encryptValue: (value: string) => { encrypted: string, iv: string, authTag: string },
 *   formatEncryptedValue: (encrypted: string, iv: string, authTag: string) => string,
 *   verificationCapabilityChangeReceiptRepository?: {
 *     record: (request: { client: { query: Function }, receipt: Record<string, unknown> }) => Promise<unknown>,
 *   },
 *   verificationCapabilityChangeReceiptActorId?: string | null,
 * }} options
 */
export async function persistAiSettingsConfig({
  client,
  body = /** @type {AiSettingsPersistenceConfig} */ ({}),
  logger,
  validateAndNormalizeRagLoopConfig,
  encryptValue,
  formatEncryptedValue,
  verificationCapabilityChangeReceiptRepository = null,
  verificationCapabilityChangeReceiptActorId = null,
}) {
  const existingResult = await client.query('SELECT * FROM ai_provider_config WHERE id = 1 FOR UPDATE');
  const existing = /** @type {AiSettingsPersistenceConfig} */ (existingResult.rows[0] || {});

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
  const textEmbeddingsCleared = await clearEmbeddingsOnIdentityChange({
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
                configuration_revision,
                updated_at
            ) VALUES (
                1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49,
                $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, NOW()
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
                configuration_revision = EXCLUDED.configuration_revision,
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
  const config = /** @type {AiSettingsPersistenceConfig} */ (latestResult.rows[0] || {});

  const persistedConfig = await resetImageEmbeddingModelCache({
    client,
    existing,
    config,
  });

  if (verificationCapabilityChangeReceiptRepository) {
    const receipt = buildCandidateBoundVerificationCapabilityChangeReceipt({
      beforeConfiguration: existing,
      afterConfiguration: persistedConfig,
      actorId: verificationCapabilityChangeReceiptActorId,
      configurationRevision: resolvePersistedConfigurationRevision({
        existing,
        persistedConfig,
      }),
    });
    if (receipt) {
      await verificationCapabilityChangeReceiptRepository.record({ client, receipt });
    }
  }

  return {
    config: persistedConfig,
    effects: {
      textEmbeddingsCleared,
    },
  };
}
