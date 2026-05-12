/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isMaskedToken, maskToken } from '../../utils/tokenMasking.mjs';
import {
  normalizeImageEmbeddingLocalPort,
  normalizeImageEmbeddingMode,
} from './aiSettingsHelpers.mjs';

export function resolveStoredSecretValue(submittedValue, existingValue) {
  if (isMaskedToken(submittedValue)) {
    return existingValue || '';
  }

  if (submittedValue === undefined || submittedValue === null) {
    return existingValue || '';
  }

  return submittedValue;
}

export function resolveStoredImageEmbeddingLocalApiKey({
  submittedValue,
  existingValue,
  encryptValue,
  formatEncryptedValue,
  logger,
}) {
  const normalizedValue = typeof submittedValue === 'string'
    ? submittedValue.trim()
    : submittedValue;

  if (normalizedValue === '') {
    logger.info('[AUDIT] Sidecar API key updated', { action: 'cleared' });
    return null;
  }

  if (
    normalizedValue === undefined ||
    normalizedValue === null ||
    isMaskedToken(normalizedValue)
  ) {
    return existingValue || null;
  }

  const { encrypted, iv, authTag } = encryptValue(normalizedValue);
  logger.info('[AUDIT] Sidecar API key updated', { action: 'set' });
  return formatEncryptedValue(encrypted, iv, authTag);
}

export function normalizeImageEmbeddingConfigState({
  config,
  mode,
  host,
  port,
}) {
  config.image_embedding_provider_mode = normalizeImageEmbeddingMode(mode ?? config.image_embedding_provider_mode);
  config.image_embedding_local_port = normalizeImageEmbeddingLocalPort({
    mode: config.image_embedding_provider_mode,
    host: host ?? config.image_embedding_local_host,
    port: port ?? config.image_embedding_local_port,
  });

  return config;
}

export function maskAiSettingsSecretFields({
  config,
  parseEncryptedValue,
  decryptValue,
}) {
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

  return config;
}
