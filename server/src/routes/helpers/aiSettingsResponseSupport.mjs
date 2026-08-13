/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  maskAiSettingsSecretFields,
  normalizeImageEmbeddingConfigState,
} from './aiSettingsConfigSupport.mjs';

/**
 * @typedef {{
 *   [key: string]: unknown,
 *   api_key?: string | null,
 *   embedding_cloud_api_key?: string | null,
 *   image_embedding_cloud_api_key?: string | null,
 *   image_embedding_local_api_key?: string | null,
 *   image_embedding_provider_mode?: string | null,
 *   image_embedding_local_host?: string | null,
 *   image_embedding_local_port?: number | string | null,
 * }} AiSettingsResponseConfig
 */

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

const ALWAYS_PRIVATE_COLUMNS = [
  // The revision is an internal receipt idempotency boundary, not a setting.
  'configuration_revision',
];

export function stripAiSettingsInternalState(config) {
  for (const column of INTERNAL_STATE_COLUMNS) {
    delete config[column];
  }

  return config;
}

/**
 * @param {{
 *   config: AiSettingsResponseConfig | null | undefined,
 *   normalizedConfig?: Record<string, unknown>,
 *   parseEncryptedValue: (formatted: string) => { encrypted: string, iv: string, authTag: string },
 *   decryptValue: (encrypted: string, iv: string, authTag: string) => string,
 *   stripInternalState?: boolean,
 * }} options
 * @returns {AiSettingsResponseConfig | null | undefined}
 */
export function finalizeAiSettingsResponseConfig({
  config,
  normalizedConfig,
  parseEncryptedValue,
  decryptValue,
  stripInternalState = false,
}) {
  if (!config) {
    return config;
  }

  if (normalizedConfig) {
    Object.assign(config, normalizedConfig);
  }

  normalizeImageEmbeddingConfigState({ config });
  for (const column of ALWAYS_PRIVATE_COLUMNS) {
    delete config[column];
  }
  maskAiSettingsSecretFields({
    config,
    parseEncryptedValue,
    decryptValue,
  });

  if (stripInternalState) {
    stripAiSettingsInternalState(config);
  }

  return config;
}
