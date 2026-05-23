/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  hasTextEmbeddingIdentityChanged,
  resolveEffectiveTextEmbeddingIdentity,
} from './aiSettingsHelpers.mjs';

export async function clearEmbeddingsOnIdentityChange({ client, logger, existing, nextTextEmbeddingConfig }) {
  const previousEmbeddingIdentity = resolveEffectiveTextEmbeddingIdentity(existing);
  const nextEmbeddingIdentity = resolveEffectiveTextEmbeddingIdentity(nextTextEmbeddingConfig);
  const textEmbeddingIdentityChanged = hasTextEmbeddingIdentityChanged(existing, nextTextEmbeddingConfig);

  if (!textEmbeddingIdentityChanged) {
    return false;
  }

  try {
    await client.query('DELETE FROM classification_embeddings');
    try {
      await client.query(
        'INSERT INTO rag_logs (level, type, message) VALUES ($1, $2, $3)',
        [
          'warning',
          'settings',
          `Text embedding identity changed from ${previousEmbeddingIdentity.provider}:${previousEmbeddingIdentity.model} to ${nextEmbeddingIdentity.provider}:${nextEmbeddingIdentity.model}; cleared classification_embeddings for re-embedding.`,
        ],
      );
    } catch (auditError) {
      logger.error('Failed to persist RAG embedding-clear audit log', { error: auditError.message });
    }
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

  return true;
}

export async function updateNormalizedRagLoopConfig({ client, normalizedRagLoopConfig }) {
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

export async function resetImageEmbeddingModelCache({ client, existing, config }) {
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
