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

export function stripAiSettingsInternalState(config) {
  for (const column of INTERNAL_STATE_COLUMNS) {
    delete config[column];
  }

  return config;
}

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
