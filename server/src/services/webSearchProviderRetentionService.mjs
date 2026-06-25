/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { webSearchProviderUsageCache as defaultCacheStore } from './webSearchProviderUsageCache.mjs';

const DEFAULT_USAGE_RETENTION_DAYS = 62;
const USAGE_RETENTION_SETTING_KEY = 'web_search_provider_usage_retention_days';
const DEFAULT_USAGE_PURGE_BATCH_SIZE = 1000;
const MAX_USAGE_PURGE_BATCH_SIZE = 5000;
const DEFAULT_CACHE_PURGE_BATCH_SIZE = 500;

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampBatchSize(value, fallback) {
  const parsed = toPositiveInteger(value, fallback);
  return Math.max(1, Math.min(parsed, MAX_USAGE_PURGE_BATCH_SIZE));
}

export function normalizeWebSearchProviderRetentionPolicy(input = {}) {
  return {
    usageRetentionDays: toPositiveInteger(
      input.usageRetentionDays,
      DEFAULT_USAGE_RETENTION_DAYS
    ),
    usageBatchSize: clampBatchSize(
      input.usageBatchSize,
      DEFAULT_USAGE_PURGE_BATCH_SIZE
    ),
    cacheBatchSize: clampBatchSize(
      input.cacheBatchSize,
      DEFAULT_CACHE_PURGE_BATCH_SIZE
    ),
  };
}

export class WebSearchProviderRetentionService {
  constructor({
    db = defaultDb,
    cacheStore = defaultCacheStore,
    logger = createLogger('WebSearchProviderRetentionService'),
  } = {}) {
    this.db = db;
    this.cacheStore = cacheStore;
    this.logger = logger;
  }

  async readUsageRetentionDays() {
    const result = await this.db.query(
      `SELECT value
         FROM settings
        WHERE key = $1
        LIMIT 1`,
      [USAGE_RETENTION_SETTING_KEY]
    );
    return toPositiveInteger(result.rows[0]?.value, DEFAULT_USAGE_RETENTION_DAYS);
  }

  async deleteOldUsageRows({
    now = new Date(),
    retentionDays = DEFAULT_USAGE_RETENTION_DAYS,
    limit = DEFAULT_USAGE_PURGE_BATCH_SIZE,
  } = {}) {
    const policy = normalizeWebSearchProviderRetentionPolicy({
      usageRetentionDays: retentionDays,
      usageBatchSize: limit,
    });

    const result = await this.db.query(
      `DELETE FROM web_search_provider_usage
        WHERE id IN (
          SELECT id
            FROM web_search_provider_usage
           WHERE searched_at < LEAST(
             $1::timestamptz - ($2::integer * INTERVAL '1 day'),
             date_trunc('month', $1::timestamptz)
           )
           ORDER BY searched_at ASC, id ASC
           LIMIT $3
        )`,
      [now, policy.usageRetentionDays, policy.usageBatchSize]
    );

    return result.rowCount || 0;
  }

  async cleanup({
    now = new Date(),
    usageRetentionDays = null,
    usageBatchSize = DEFAULT_USAGE_PURGE_BATCH_SIZE,
    cacheBatchSize = DEFAULT_CACHE_PURGE_BATCH_SIZE,
  } = {}) {
    try {
      const resolvedRetentionDays = usageRetentionDays
        ?? await this.readUsageRetentionDays();
      const policy = normalizeWebSearchProviderRetentionPolicy({
        usageRetentionDays: resolvedRetentionDays,
        usageBatchSize,
        cacheBatchSize,
      });

      let usageDeleted = 0;
      let deletedInBatch = 0;
      do {
        deletedInBatch = await this.deleteOldUsageRows({
          now,
          retentionDays: policy.usageRetentionDays,
          limit: policy.usageBatchSize,
        });
        usageDeleted += deletedInBatch;
      } while (deletedInBatch === policy.usageBatchSize);

      const expiredCacheKeys = await this.cacheStore.deleteExpired({
        now,
        limit: policy.cacheBatchSize,
      });

      const summary = {
        usageDeleted,
        cacheDeleted: expiredCacheKeys.length,
        usageRetentionDays: policy.usageRetentionDays,
      };

      if (usageDeleted > 0 || expiredCacheKeys.length > 0) {
        this.logger.info('Web search provider retention cleanup complete', summary);
      } else {
        this.logger.debug('Web search provider retention cleanup: no rows to delete', summary);
      }

      return summary;
    } catch (error) {
      this.logger.error('Web search provider retention cleanup failed', {
        error: error.message,
      });
      return {
        usageDeleted: 0,
        cacheDeleted: 0,
        usageRetentionDays: null,
        error: error.message,
      };
    }
  }
}

export const webSearchProviderRetentionService = new WebSearchProviderRetentionService();
