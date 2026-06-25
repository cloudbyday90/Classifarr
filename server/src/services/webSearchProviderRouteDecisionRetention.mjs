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

export const WEB_SEARCH_ROUTE_DECISION_RETENTION_SETTING_KEY = 'web_search_provider_route_decision_retention_days';

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_PURGE_BATCH_SIZE = 1000;
const MAX_PURGE_BATCH_SIZE = 5000;
const MAX_RETENTION_DAYS = 365;

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampPositiveInteger(value, fallback, maximum) {
  return Math.max(1, Math.min(toPositiveInteger(value, fallback), maximum));
}

export function normalizeWebSearchRouteDecisionRetentionPolicy(input = {}) {
  return {
    retentionDays: clampPositiveInteger(
      input.retentionDays,
      DEFAULT_RETENTION_DAYS,
      MAX_RETENTION_DAYS
    ),
    batchSize: clampPositiveInteger(
      input.batchSize,
      DEFAULT_PURGE_BATCH_SIZE,
      MAX_PURGE_BATCH_SIZE
    ),
  };
}

export class WebSearchProviderRouteDecisionRetentionService {
  constructor({
    db = defaultDb,
    logger = createLogger('WebSearchProviderRouteDecisionRetentionService'),
  } = {}) {
    this.db = db;
    this.logger = logger;
  }

  async readRetentionDays() {
    const result = await this.db.query(
      `SELECT value
         FROM settings
        WHERE key = $1
        LIMIT 1`,
      [WEB_SEARCH_ROUTE_DECISION_RETENTION_SETTING_KEY]
    );
    return normalizeWebSearchRouteDecisionRetentionPolicy({
      retentionDays: result.rows[0]?.value,
    }).retentionDays;
  }

  async deleteOldRouteDecisionRows({
    now = new Date(),
    retentionDays = DEFAULT_RETENTION_DAYS,
    limit = DEFAULT_PURGE_BATCH_SIZE,
  } = {}) {
    const policy = normalizeWebSearchRouteDecisionRetentionPolicy({
      retentionDays,
      batchSize: limit,
    });

    const result = await this.db.query(
      `DELETE FROM web_search_provider_route_decisions
        WHERE id IN (
          SELECT id
            FROM web_search_provider_route_decisions
           WHERE created_at < $1::timestamptz - ($2::integer * INTERVAL '1 day')
           ORDER BY created_at ASC, id ASC
           LIMIT $3
        )`,
      [now, policy.retentionDays, policy.batchSize]
    );

    return result.rowCount || 0;
  }

  async cleanup({
    now = new Date(),
    retentionDays = null,
    batchSize = DEFAULT_PURGE_BATCH_SIZE,
  } = {}) {
    try {
      const resolvedRetentionDays = retentionDays
        ?? await this.readRetentionDays();
      const policy = normalizeWebSearchRouteDecisionRetentionPolicy({
        retentionDays: resolvedRetentionDays,
        batchSize,
      });

      let deleted = 0;
      let deletedInBatch = 0;
      do {
        deletedInBatch = await this.deleteOldRouteDecisionRows({
          now,
          retentionDays: policy.retentionDays,
          limit: policy.batchSize,
        });
        deleted += deletedInBatch;
      } while (deletedInBatch === policy.batchSize);

      const summary = {
        routeDecisionsDeleted: deleted,
        routeDecisionRetentionDays: policy.retentionDays,
      };

      if (deleted > 0) {
        this.logger.info('Web search provider route decision retention cleanup complete', summary);
      } else {
        this.logger.debug('Web search provider route decision retention cleanup: no rows to delete', summary);
      }

      return summary;
    } catch (error) {
      this.logger.error('Web search provider route decision retention cleanup failed', {
        error: error.message,
      });
      return {
        routeDecisionsDeleted: 0,
        routeDecisionRetentionDays: null,
        error: error.message,
      };
    }
  }
}

export const webSearchProviderRouteDecisionRetentionService = new WebSearchProviderRouteDecisionRetentionService();
