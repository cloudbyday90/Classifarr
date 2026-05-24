/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('IdleBackfillConfig');

export function isTextBackfillConfigured(config = {}) {
  const mode = String(config.embedding_provider_mode || 'same').toLowerCase();

  if (mode === 'same') {
    const provider = String(config.primary_provider || '').toLowerCase();
    return provider !== '' && provider !== 'none';
  }

  if (mode === 'separate_ollama') {
    return String(config.embedding_ollama_host || '').trim().length > 0;
  }

  if (mode === 'cloud') {
    return String(config.embedding_cloud_provider || '').trim().length > 0
      && String(config.embedding_cloud_api_key || '').trim().length > 0;
  }

  return false;
}

export async function loadIdleBackfillConfig({ db: dbClient = db, idleDetector } = {}) {
  try {
    const result = await dbClient.query(`
      SELECT
        rag_enabled,
        idle_backfill_enabled,
        idle_threshold,
        idle_batch_size,
        embedding_provider_mode,
        primary_provider,
        embedding_ollama_host,
        embedding_cloud_provider,
        embedding_cloud_api_key
      FROM ai_provider_config
      WHERE id = 1
    `);

    if (result.rows.length > 0) {
      const config = result.rows[0];

      if (config.idle_threshold && idleDetector) {
        idleDetector.setIdleThreshold(config.idle_threshold);
      }

      return config;
    }

    return { rag_enabled: false, idle_backfill_enabled: false };
  } catch (error) {
    logger.error('Failed to load idle backfill config', { error: error.message });
    return null;
  }
}
