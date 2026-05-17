/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const DEFAULT_GENERAL_WORKERS = 1;
const DEFAULT_METADATA_ENRICHMENT_WORKERS = 5;
const MIN_WORKERS = 1;
const MAX_GENERAL_WORKERS = 5;
const MAX_METADATA_ENRICHMENT_WORKERS = 20;

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

export class QueueConcurrencySettingsService {
  constructor(deps = {}) {
    this.db = deps.db;
    this.logger = deps.logger;
    this.cacheTtlMs = deps.cacheTtlMs || 5_000;
    this.now = deps.now || (() => Date.now());
    this.cachedConfig = null;
    this.cacheExpiresAt = 0;
  }

  invalidate() {
    this.cachedConfig = null;
    this.cacheExpiresAt = 0;
  }

  buildDefaultConfig() {
    return {
      generalWorkers: DEFAULT_GENERAL_WORKERS,
      metadataEnrichmentWorkers: DEFAULT_METADATA_ENRICHMENT_WORKERS,
    };
  }

  normalizeRows(rows = []) {
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    return {
      generalWorkers: clampInteger(
        byKey.queue_concurrent_workers,
        DEFAULT_GENERAL_WORKERS,
        MIN_WORKERS,
        MAX_GENERAL_WORKERS,
      ),
      metadataEnrichmentWorkers: clampInteger(
        byKey.queue_metadata_enrichment_workers,
        DEFAULT_METADATA_ENRICHMENT_WORKERS,
        MIN_WORKERS,
        MAX_METADATA_ENRICHMENT_WORKERS,
      ),
    };
  }

  async getConfig() {
    const now = this.now();
    if (this.cachedConfig && now < this.cacheExpiresAt) {
      return this.cachedConfig;
    }

    try {
      const result = await this.db.query(
        `SELECT key, value
           FROM settings
          WHERE key = ANY($1::text[])`,
        [[
          'queue_concurrent_workers',
          'queue_metadata_enrichment_workers',
        ]],
      );

      this.cachedConfig = this.normalizeRows(result.rows);
      this.cacheExpiresAt = now + this.cacheTtlMs;
      return this.cachedConfig;
    } catch (error) {
      this.logger?.warn?.('Failed to load queue concurrency settings; using defaults', {
        error: error.message,
      });
      this.cachedConfig = this.buildDefaultConfig();
      this.cacheExpiresAt = now + this.cacheTtlMs;
      return this.cachedConfig;
    }
  }
}

