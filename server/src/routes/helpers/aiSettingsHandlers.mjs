/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import encryptionModule from '../../utils/encryption.mjs';

const AI_SETTINGS_ALLOWED_KEYS = Object.freeze([
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

function normalizeImageEmbeddingMode(mode) {
  const rawMode = String(mode || '').toLowerCase();

  if (rawMode === 'local') {
    return 'separate_local';
  }
  if (['disabled', 'separate_local', 'cloud'].includes(rawMode)) {
    return rawMode;
  }
  return 'disabled';
}

function normalizeImageEmbeddingLocalPort({ mode, host, port }) {
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

function validateAiSettingsPayloadKeys(rawConfig = {}, ragLoopDefaults = {}) {
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

export function createAiSettingsHandlers({
  db,
  logger,
  cloudLLMService,
  aiRouterService,
  ollamaService,
  embeddingProvider,
  embeddingRouter,
  getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig,
  validateRagLoopConfigPayloadKeys,
  getDefaultAiSettingsConfig,
  hasTextEmbeddingIdentityChanged,
  resolveEffectiveTextEmbeddingIdentity,
  maskToken,
  isMaskedToken,
  resolveRequestApiKey,
  encryptValue = encryptionModule.encryptValue,
  formatEncryptedValue = encryptionModule.formatEncryptedValue,
  parseEncryptedValue = encryptionModule.parseEncryptedValue,
  decryptValue = encryptionModule.decryptValue,
}) {
  return {
    async getConfig(_req, res) {
      try {
        const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');

        if (result.rows.length === 0) {
          return res.json(getDefaultAiSettingsConfig(getRagLoopDefaultConfig));
        }

        const config = result.rows[0];
        const { normalizedConfig } = validateAndNormalizeRagLoopConfig(config, config);
        Object.assign(config, normalizedConfig);
        config.image_embedding_provider_mode = normalizeImageEmbeddingMode(config.image_embedding_provider_mode);
        config.image_embedding_local_port = normalizeImageEmbeddingLocalPort({
          mode: config.image_embedding_provider_mode,
          host: config.image_embedding_local_host,
          port: config.image_embedding_local_port,
        });

        if (config.api_key) {
          config.api_key = maskToken(config.api_key);
        }
        if (config.embedding_cloud_api_key) {
          config.embedding_cloud_api_key = maskToken(config.embedding_cloud_api_key);
        }
        if (config.image_embedding_cloud_api_key) {
          config.image_embedding_cloud_api_key = maskToken(config.image_embedding_cloud_api_key);
        }
        if (config.image_embedding_local_api_key) {
          try {
            const { encrypted, iv, authTag } = parseEncryptedValue(config.image_embedding_local_api_key);
            const plaintext = decryptValue(encrypted, iv, authTag);
            config.image_embedding_local_api_key = maskToken(plaintext);
          } catch {
            config.image_embedding_local_api_key = null;
          }
        }

        const INTERNAL_STATE_COLUMNS = [
          'rag_loop_auto_fallback_breach_count',
          'rag_loop_auto_fallback_last_breach_at',
          'rag_loop_auto_fallback_last_triggered_at',
          'rag_loop_auto_fallback_cooldown_until',
          'rag_loop_auto_fallback_last_incident_id',
          'rag_loop_auto_fallback_last_incident_payload',
          'rag_loop_auto_fallback_last_version',
          'rag_loop_auto_recover_last_attempt_version',
          'rag_loop_auto_recover_last_attempt_at',
          'image_embedding_models_cache',
          'image_embedding_models_cache_updated_at',
        ];
        for (const col of INTERNAL_STATE_COLUMNS) {
          delete config[col];
        }

        return res.json(config);
      } catch (error) {
        if (error.code === '42P01') {
          return res.json(getDefaultAiSettingsConfig(getRagLoopDefaultConfig, {
            table_not_ready: true,
          }));
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async updateConfig(req, res) {
      const ragLoopConfigKeyValidation = validateRagLoopConfigPayloadKeys(req.body || {});
      if (!ragLoopConfigKeyValidation.valid) {
        return res.status(400).json({
          error: 'Unsupported RAG loop configuration keys in payload. Please reload the page and try again.',
          unknown_rag_loop_config_keys: ragLoopConfigKeyValidation.unknownKeys,
          disallowed_rag_loop_override_keys: ragLoopConfigKeyValidation.disallowedKeys,
        });
      }

      const aiSettingsKeyValidation = validateAiSettingsPayloadKeys(req.body || {}, getRagLoopDefaultConfig());
      if (!aiSettingsKeyValidation.valid) {
        return res.status(400).json({
          error: 'Unsupported AI settings keys in payload. Please reload the page and try again.',
          unknown_ai_settings_keys: aiSettingsKeyValidation.unknownKeys,
        });
      }

      try {
        const config = await db.withTransaction(async (client) => {
        const {
          primary_provider,
          api_endpoint,
          api_key,
          model,
          temperature,
          max_tokens,
          monthly_budget_usd,
          budget_alert_threshold,
          pause_on_budget_exhausted,
          ollama_fallback_enabled,
          ollama_for_basic_tasks,
          ollama_for_budget_exhausted,
          ollama_host,
          ollama_port,
          ollama_model,
          rag_enabled,
          embedding_provider,
          embedding_model,
          rag_similarity_threshold,
          rag_text_weight,
          rag_image_weight,
          rag_min_history_count,
          rag_backfill_budget_type,
          rag_backfill_budget_value,
          formula_pattern_weight,
          formula_rule_weight,
          formula_rag_weight,
          formula_history_weight,
          embedding_provider_mode,
          embedding_ollama_host,
          embedding_ollama_port,
          embedding_ollama_model,
          embedding_cloud_provider,
          embedding_cloud_api_key,
          embedding_cloud_model,
          image_embedding_provider_mode,
          image_embedding_local_host,
          image_embedding_local_port,
          image_embedding_local_model,
          image_embedding_cloud_provider,
          image_embedding_cloud_api_key,
          image_embedding_cloud_model,
          image_embedding_cloud_api_endpoint,
          image_embedding_image_size,
          image_embedding_rps,
          image_embedding_concurrency,
          image_embedding_batch_size,
          image_embedding_cache_ttl_hours,
          image_embedding_cache_max_mb,
          image_embedding_local_api_key,
          image_embedding_local_timeout_ms,
          rag_graph_enabled,
          rag_graph_weight,
          rag_graph_collection_enabled,
          rag_graph_director_enabled,
          rag_graph_studio_enabled,
          rag_graph_cast_enabled,
          rag_graph_genre_enabled,
          rag_graph_min_matches_to_apply,
          rag_graph_candidates_limit,
        } = req.body;

        const existingResult = await client.query('SELECT * FROM ai_provider_config WHERE id = 1');
        const existing = existingResult.rows[0] || {};

        const { normalizedConfig: normalizedRagLoopConfig, warnings: ragLoopWarnings } =
          validateAndNormalizeRagLoopConfig(req.body, existing);

        if (ragLoopWarnings.length > 0) {
          logger.warn('RAG loop config values normalized to safe bounds/defaults', {
            warnings: ragLoopWarnings,
          });
        }

        let finalApiKey = api_key;
        if (isMaskedToken(api_key)) {
          finalApiKey = existing.api_key || '';
        } else if (api_key === undefined || api_key === null) {
          finalApiKey = existing.api_key || '';
        }

        let finalEmbeddingCloudApiKey = embedding_cloud_api_key;
        if (isMaskedToken(embedding_cloud_api_key)) {
          finalEmbeddingCloudApiKey = existing.embedding_cloud_api_key || '';
        } else if (embedding_cloud_api_key === undefined || embedding_cloud_api_key === null) {
          finalEmbeddingCloudApiKey = existing.embedding_cloud_api_key || '';
        }

        let finalImageEmbeddingCloudApiKey = image_embedding_cloud_api_key;
        if (isMaskedToken(image_embedding_cloud_api_key)) {
          finalImageEmbeddingCloudApiKey = existing.image_embedding_cloud_api_key || '';
        } else if (image_embedding_cloud_api_key === undefined || image_embedding_cloud_api_key === null) {
          finalImageEmbeddingCloudApiKey = existing.image_embedding_cloud_api_key || '';
        }

        let finalImageEmbeddingLocalApiKey;
        const normalizedImageEmbeddingLocalApiKey = typeof image_embedding_local_api_key === 'string'
          ? image_embedding_local_api_key.trim()
          : image_embedding_local_api_key;

        if (normalizedImageEmbeddingLocalApiKey === '') {
          finalImageEmbeddingLocalApiKey = null;
          logger.info('[AUDIT] Sidecar API key updated', { action: 'cleared' });
        } else if (
          normalizedImageEmbeddingLocalApiKey === undefined ||
          normalizedImageEmbeddingLocalApiKey === null ||
          isMaskedToken(normalizedImageEmbeddingLocalApiKey)
        ) {
          finalImageEmbeddingLocalApiKey = existing.image_embedding_local_api_key || null;
        } else {
          const { encrypted, iv, authTag } = encryptValue(normalizedImageEmbeddingLocalApiKey);
          finalImageEmbeddingLocalApiKey = formatEncryptedValue(encrypted, iv, authTag);
          logger.info('[AUDIT] Sidecar API key updated', { action: 'set' });
        }

        const normalizedExistingImageEmbeddingMode = normalizeImageEmbeddingMode(existing.image_embedding_provider_mode);
        const normalizedImageEmbeddingMode = image_embedding_provider_mode === undefined
          ? undefined
          : normalizeImageEmbeddingMode(image_embedding_provider_mode);
        const finalImageEmbeddingMode = normalizedImageEmbeddingMode ?? normalizedExistingImageEmbeddingMode;
        const finalImageEmbeddingLocalHost = image_embedding_local_host ?? existing.image_embedding_local_host ?? '';
        const finalImageEmbeddingLocalPort = image_embedding_local_port !== undefined
          ? normalizeImageEmbeddingLocalPort({
            mode: finalImageEmbeddingMode,
            host: finalImageEmbeddingLocalHost,
            port: image_embedding_local_port,
          })
          : normalizeImageEmbeddingLocalPort({
            mode: finalImageEmbeddingMode,
            host: finalImageEmbeddingLocalHost,
            port: existing.image_embedding_local_port,
          });

        const nextTextEmbeddingConfig = {
          ...existing,
          primary_provider: primary_provider ?? existing.primary_provider ?? 'none',
          embedding_provider_mode: embedding_provider_mode ?? existing.embedding_provider_mode ?? 'same',
          embedding_provider: embedding_provider ?? existing.embedding_provider ?? 'auto',
          embedding_model: embedding_model ?? existing.embedding_model ?? '',
          embedding_ollama_model: embedding_ollama_model ?? existing.embedding_ollama_model ?? '',
          embedding_cloud_provider: embedding_cloud_provider ?? existing.embedding_cloud_provider ?? '',
          embedding_cloud_model: embedding_cloud_model ?? existing.embedding_cloud_model ?? '',
        };

        const previousEmbeddingIdentity = resolveEffectiveTextEmbeddingIdentity(existing);
        const nextEmbeddingIdentity = resolveEffectiveTextEmbeddingIdentity(nextTextEmbeddingConfig);
        const textEmbeddingIdentityChanged = hasTextEmbeddingIdentityChanged(existing, nextTextEmbeddingConfig);

        if (textEmbeddingIdentityChanged) {
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

        const providedWeights = [formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight];
        const hasWeights = providedWeights.some((weight) => weight !== undefined);

        if (hasWeights) {
          const currentWeights = existing || {};
          const finalPatternWeight = formula_pattern_weight ?? currentWeights.formula_pattern_weight ?? 0.40;
          const finalRuleWeight = formula_rule_weight ?? currentWeights.formula_rule_weight ?? 0.30;
          const finalRagWeight = formula_rag_weight ?? currentWeights.formula_rag_weight ?? 0.20;
          const finalHistoryWeight = formula_history_weight ?? currentWeights.formula_history_weight ?? 0.10;

          const sum = finalPatternWeight + finalRuleWeight + finalRagWeight + finalHistoryWeight;

          if (sum < 0.99 || sum > 1.01) {
            const err = new Error(`Formula weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust the weights so they total 100%.`);
            err.httpStatus = 400;
            err.currentSum = sum;
            throw err;
          }
        }

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
        `, [
          primary_provider ?? existing.primary_provider ?? 'none',
          api_endpoint ?? existing.api_endpoint ?? '',
          finalApiKey || '',
          model ?? existing.model ?? '',
          temperature ?? existing.temperature ?? 0.7,
          max_tokens ?? existing.max_tokens ?? 2000,
          monthly_budget_usd ?? existing.monthly_budget_usd ?? null,
          budget_alert_threshold ?? existing.budget_alert_threshold ?? 80,
          pause_on_budget_exhausted ?? existing.pause_on_budget_exhausted ?? true,
          ollama_fallback_enabled ?? existing.ollama_fallback_enabled ?? false,
          ollama_for_basic_tasks ?? existing.ollama_for_basic_tasks ?? false,
          ollama_for_budget_exhausted ?? existing.ollama_for_budget_exhausted ?? true,
          ollama_host ?? existing.ollama_host ?? 'localhost',
          ollama_port ?? existing.ollama_port ?? 11434,
          ollama_model ?? existing.ollama_model ?? 'llama3.2',
          rag_enabled ?? existing.rag_enabled ?? false,
          embedding_provider ?? existing.embedding_provider ?? 'auto',
          embedding_model ?? existing.embedding_model ?? '',
          rag_similarity_threshold ?? existing.rag_similarity_threshold ?? 0.70,
          rag_text_weight ?? existing.rag_text_weight ?? 0.70,
          rag_image_weight ?? existing.rag_image_weight ?? 0.30,
          rag_min_history_count ?? existing.rag_min_history_count ?? 50,
          rag_backfill_budget_type ?? existing.rag_backfill_budget_type ?? 'percentage',
          rag_backfill_budget_value ?? existing.rag_backfill_budget_value ?? 25,
          formula_pattern_weight ?? existing.formula_pattern_weight ?? 0.40,
          formula_rule_weight ?? existing.formula_rule_weight ?? 0.30,
          formula_rag_weight ?? existing.formula_rag_weight ?? 0.20,
          formula_history_weight ?? existing.formula_history_weight ?? 0.10,
          embedding_provider_mode ?? existing.embedding_provider_mode ?? 'same',
          embedding_ollama_host ?? existing.embedding_ollama_host ?? '',
          embedding_ollama_port ?? existing.embedding_ollama_port ?? 11434,
          embedding_ollama_model ?? existing.embedding_ollama_model ?? '',
          embedding_cloud_provider ?? existing.embedding_cloud_provider ?? '',
          finalEmbeddingCloudApiKey || '',
          embedding_cloud_model ?? existing.embedding_cloud_model ?? '',
          finalImageEmbeddingMode,
          finalImageEmbeddingLocalHost,
          finalImageEmbeddingLocalPort,
          image_embedding_local_model ?? existing.image_embedding_local_model ?? '',
          image_embedding_cloud_provider ?? existing.image_embedding_cloud_provider ?? '',
          finalImageEmbeddingCloudApiKey || '',
          image_embedding_cloud_model ?? existing.image_embedding_cloud_model ?? '',
          image_embedding_cloud_api_endpoint ?? existing.image_embedding_cloud_api_endpoint ?? '',
          image_embedding_image_size ?? existing.image_embedding_image_size ?? 512,
          image_embedding_rps ?? existing.image_embedding_rps ?? 2,
          image_embedding_concurrency ?? existing.image_embedding_concurrency ?? 2,
          image_embedding_batch_size ?? existing.image_embedding_batch_size ?? 1,
          image_embedding_cache_ttl_hours ?? existing.image_embedding_cache_ttl_hours ?? 24,
          image_embedding_cache_max_mb ?? existing.image_embedding_cache_max_mb ?? 1024,
          rag_graph_enabled ?? existing.rag_graph_enabled ?? false,
          rag_graph_weight ?? existing.rag_graph_weight ?? 0.20,
          rag_graph_collection_enabled ?? existing.rag_graph_collection_enabled ?? true,
          rag_graph_director_enabled ?? existing.rag_graph_director_enabled ?? true,
          rag_graph_studio_enabled ?? existing.rag_graph_studio_enabled ?? false,
          rag_graph_cast_enabled ?? existing.rag_graph_cast_enabled ?? false,
          rag_graph_genre_enabled ?? existing.rag_graph_genre_enabled ?? false,
          rag_graph_min_matches_to_apply ?? existing.rag_graph_min_matches_to_apply ?? 1,
          rag_graph_candidates_limit ?? existing.rag_graph_candidates_limit ?? 20,
          finalImageEmbeddingLocalApiKey ?? null,
          image_embedding_local_timeout_ms ?? existing.image_embedding_local_timeout_ms ?? 15000,
        ]);

        const ragLoopKeys = Object.keys(normalizedRagLoopConfig);
        if (ragLoopKeys.length > 0) {
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

        const latestResult = await client.query('SELECT * FROM ai_provider_config WHERE id = 1');
        const config = latestResult.rows[0];
        const localConfigChanged = (
          (existing.image_embedding_local_host || '') !== (config.image_embedding_local_host || '') ||
          Number(existing.image_embedding_local_port || 8000) !== Number(config.image_embedding_local_port || 8000)
        );
        const cloudConfigChanged = (
          (existing.image_embedding_cloud_provider || '') !== (config.image_embedding_cloud_provider || '') ||
          (existing.image_embedding_cloud_api_endpoint || '') !== (config.image_embedding_cloud_api_endpoint || '')
        );

        if (localConfigChanged || cloudConfigChanged) {
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
        }

        return config;
        }); // end withTransaction

        aiRouterService.clearCache();
        ollamaService.resetConfig();
        embeddingProvider.resetConfig();
        embeddingRouter.resetConfig();

        if (config.api_key) {
          config.api_key = maskToken(config.api_key);
        }
        if (config.embedding_cloud_api_key) {
          config.embedding_cloud_api_key = maskToken(config.embedding_cloud_api_key);
        }
        if (config.image_embedding_cloud_api_key) {
          config.image_embedding_cloud_api_key = maskToken(config.image_embedding_cloud_api_key);
        }
        if (config.image_embedding_local_api_key) {
          try {
            const { encrypted, iv, authTag } = parseEncryptedValue(config.image_embedding_local_api_key);
            const plaintext = decryptValue(encrypted, iv, authTag);
            config.image_embedding_local_api_key = maskToken(plaintext);
          } catch {
            config.image_embedding_local_api_key = null;
          }
        }
        config.image_embedding_provider_mode = normalizeImageEmbeddingMode(config.image_embedding_provider_mode);
        config.image_embedding_local_port = normalizeImageEmbeddingLocalPort({
          mode: config.image_embedding_provider_mode,
          host: config.image_embedding_local_host,
          port: config.image_embedding_local_port,
        });

        return res.json(config);
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ error: error.message, currentSum: error.currentSum });
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async testConnection(req, res) {
      try {
        const { primary_provider, api_endpoint, api_key } = req.body;
        const testApiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'ai_provider_config',
          submittedApiKey: api_key,
          allowStoredFallback: true,
        });

        if (!testApiKey) {
          return res.status(400).json({ success: false, error: 'API key is required' });
        }

        const result = await cloudLLMService.testConnection({
          primary_provider,
          api_endpoint,
          api_key: testApiKey,
        });

        return res.json(result);
      } catch (error) {
        return res.json({ success: false, error: error.message });
      }
    },

    async getModels(req, res) {
      try {
        const { primary_provider, api_endpoint, api_key } = req.body;
        const actualApiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'ai_provider_config',
          submittedApiKey: api_key,
          allowStoredFallback: true,
        });

        if (!actualApiKey) {
          return res.status(400).json({ success: false, error: 'API key is required', models: [] });
        }

        const models = await cloudLLMService.getModels({
          primary_provider,
          api_endpoint,
          api_key: actualApiKey,
        });

        return res.json({ success: true, models });
      } catch (error) {
        return res.json({ success: false, error: error.message, models: [] });
      }
    },

    async getUsage(_req, res) {
      try {
        const currentResult = await db.query(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as total_cost,
                AVG(cost_usd) as avg_cost_per_call,
                SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests
            FROM ai_usage_log
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
              AND success = true
        `);

        const lastMonthResult = await db.query(`
            SELECT * FROM ai_usage_monthly 
            WHERE year_month = to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM')
        `);

        const budgetResult = await db.query(`
            SELECT monthly_budget_usd, current_month_usage_usd, budget_alert_threshold
            FROM ai_provider_config WHERE id = 1
        `);

        const recentResult = await db.query(`
            SELECT provider, model, total_tokens, cost_usd, request_type, item_title, success, created_at
            FROM ai_usage_log
            ORDER BY created_at DESC
            LIMIT 20
        `);

        const current = currentResult.rows[0] || {};
        const lastMonth = lastMonthResult.rows[0] || {};
        const budget = budgetResult.rows[0] || {};

        return res.json({
          currentMonth: {
            requests: parseInt(current.total_requests) || 0,
            tokens: parseInt(current.total_tokens) || 0,
            cost: parseFloat(current.total_cost) || 0,
            avgCostPerCall: parseFloat(current.avg_cost_per_call) || 0,
            successRate: current.total_requests > 0
              ? Math.round((current.successful_requests / current.total_requests) * 100)
              : 100,
          },
          lastMonth: {
            requests: parseInt(lastMonth.total_requests) || 0,
            tokens: parseInt(lastMonth.total_tokens) || 0,
            cost: parseFloat(lastMonth.total_cost_usd) || 0,
          },
          budget: {
            limit: parseFloat(budget.monthly_budget_usd) || null,
            used: parseFloat(budget.current_month_usage_usd) || 0,
            alertThreshold: budget.budget_alert_threshold || 80,
            percentUsed: budget.monthly_budget_usd
              ? Math.round((budget.current_month_usage_usd / budget.monthly_budget_usd) * 100)
              : 0,
          },
          recentRequests: recentResult.rows,
        });
      } catch (error) {
        if (error.code === '42P01') {
          return res.json({
            currentMonth: { requests: 0, tokens: 0, cost: 0, avgCostPerCall: 0 },
            lastMonth: { requests: 0, tokens: 0, cost: 0 },
            budget: { limit: null, used: 0, alertThreshold: 80 },
            recentRequests: [],
          });
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async getStatus(_req, res) {
      try {
        const status = await aiRouterService.getStatus();
        return res.json(status);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async resetUsage(_req, res) {
      try {
        await cloudLLMService.resetMonthlyUsage();
        return res.json({ success: true, message: 'Monthly usage reset successfully' });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  };
}

export default {
  createAiSettingsHandlers,
};
