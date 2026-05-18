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

const logger = createLogger('aiEmbeddingProviderIntegrityService');

export const AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_STARTUP_SAMPLE_LIMIT = 10;

const ALLOWED_PRIMARY_PROVIDERS = new Set([
  'none',
  'ollama',
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'litellm',
  'custom',
]);

const CLOUD_PRIMARY_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'litellm',
  'custom',
]);

const ALLOWED_TEXT_EMBEDDING_MODES = new Set(['same', 'separate_ollama', 'cloud']);
const ALLOWED_IMAGE_EMBEDDING_MODES = new Set(['disabled', 'separate_local', 'cloud']);

function isBlank(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

export function sanitizeRuntimeSignature(value) {
  return String(value || 'generic')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .slice(0, 160);
}

export function buildAiRuntimeDedupeKey(category, signature) {
  return [
    'ai-provider-runtime',
    category || 'general',
    sanitizeRuntimeSignature(signature),
  ].join(':');
}

export function buildEmbeddingRuntimeDedupeKey(channel, category, signature) {
  return [
    'embedding-provider-runtime',
    channel || 'unknown',
    category || 'general',
    sanitizeRuntimeSignature(signature),
  ].join(':');
}

function buildIssue(area, issue, details = {}) {
  return {
    area,
    issue,
    ...details,
  };
}

export class AiEmbeddingProviderIntegrityService {
  constructor(deps = {}) {
    this.db = deps.db || db;
    this.logger = deps.logger || logger;
    this.warningDedupeWindowMs = Number.isFinite(Number(deps.warningDedupeWindowMs))
      ? Number(deps.warningDedupeWindowMs)
      : AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS;
    this.startupSampleLimit = Number.isFinite(Number(deps.startupSampleLimit))
      ? Number(deps.startupSampleLimit)
      : DEFAULT_STARTUP_SAMPLE_LIMIT;
  }

  async auditPersistedConfigs({ source = 'startup_preflight' } = {}) {
    const result = await this.db.query(`
      SELECT
        rag_enabled,
        primary_provider,
        api_key,
        api_endpoint,
        embedding_provider_mode,
        embedding_cloud_provider,
        embedding_cloud_api_key,
        embedding_ollama_host,
        rag_image_weight,
        image_embedding_provider_mode,
        image_embedding_cloud_provider,
        image_embedding_cloud_api_key,
        image_embedding_local_host
      FROM ai_provider_config
      WHERE id = 1
    `);

    const row = result.rows[0] || null;
    const issues = [];

    if (!row) {
      issues.push(buildIssue('singleton', 'missing_ai_provider_config_row'));
    } else {
      const primaryProvider = String(row.primary_provider || 'none').trim().toLowerCase();
      const textMode = String(row.embedding_provider_mode || 'same').trim().toLowerCase();
      const imageMode = String(row.image_embedding_provider_mode || 'disabled').trim().toLowerCase();
      const ragEnabled = row.rag_enabled === true;
      const imageWeight = Number(row.rag_image_weight ?? 0);
      const imageEmbeddingsEnabled = Number.isFinite(imageWeight) && imageWeight > 0;

      if (!ALLOWED_PRIMARY_PROVIDERS.has(primaryProvider)) {
        issues.push(buildIssue('ai', 'invalid_primary_provider', {
          primaryProvider: row.primary_provider || null,
        }));
      } else if (CLOUD_PRIMARY_PROVIDERS.has(primaryProvider) && isBlank(row.api_key)) {
        issues.push(buildIssue('ai', 'missing_primary_provider_api_key', {
          primaryProvider,
        }));
      }

      if ((primaryProvider === 'custom' || primaryProvider === 'litellm') && isBlank(row.api_endpoint)) {
        issues.push(buildIssue('ai', 'missing_primary_provider_api_endpoint', {
          primaryProvider,
        }));
      }

      if (ragEnabled && !ALLOWED_TEXT_EMBEDDING_MODES.has(textMode)) {
        issues.push(buildIssue('text_embedding', 'invalid_embedding_provider_mode', {
          mode: row.embedding_provider_mode || null,
        }));
      } else if (ragEnabled && textMode === 'same' && primaryProvider === 'none') {
        issues.push(buildIssue('text_embedding', 'same_mode_without_primary_provider'));
      } else if (ragEnabled && textMode === 'cloud') {
        if (isBlank(row.embedding_cloud_provider)) {
          issues.push(buildIssue('text_embedding', 'missing_cloud_provider'));
        }
        if (isBlank(row.embedding_cloud_api_key)) {
          issues.push(buildIssue('text_embedding', 'missing_cloud_api_key'));
        }
      } else if (ragEnabled && textMode === 'separate_ollama' && isBlank(row.embedding_ollama_host)) {
        issues.push(buildIssue('text_embedding', 'missing_separate_ollama_host'));
      }

      if (!ALLOWED_IMAGE_EMBEDDING_MODES.has(imageMode)) {
        issues.push(buildIssue('image_embedding', 'invalid_image_embedding_provider_mode', {
          mode: row.image_embedding_provider_mode || null,
        }));
      } else if (imageEmbeddingsEnabled && imageMode === 'disabled') {
        issues.push(buildIssue('image_embedding', 'image_weight_enabled_but_provider_disabled', {
          imageWeight,
        }));
      } else if (imageEmbeddingsEnabled && imageMode === 'cloud') {
        if (isBlank(row.image_embedding_cloud_provider)) {
          issues.push(buildIssue('image_embedding', 'missing_cloud_provider'));
        }
        if (isBlank(row.image_embedding_cloud_api_key)) {
          issues.push(buildIssue('image_embedding', 'missing_cloud_api_key'));
        }
      } else if (imageEmbeddingsEnabled && imageMode === 'separate_local' && isBlank(row.image_embedding_local_host)) {
        issues.push(buildIssue('image_embedding', 'missing_local_host'));
      }
    }

    const sample = issues.slice(0, this.startupSampleLimit);

    if (issues.length > 0) {
      this.logger.warn(
        'Persisted AI and embedding provider configuration drift detected; provider fallbacks may warn once and degrade conservatively',
        {
          source,
          invalidIssueCount: issues.length,
          issues: sample,
        },
        {
          dedupeKey: 'persisted-ai-embedding-provider-config-drift',
          dedupeWindowMs: this.warningDedupeWindowMs,
        }
      );
    }

    return {
      invalidIssueCount: issues.length,
      issues: sample,
    };
  }
}

export const aiEmbeddingProviderIntegrityService = new AiEmbeddingProviderIntegrityService();
