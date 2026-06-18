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
import { validateWebSearchResponse } from './webSearchProviderContract.mjs';
import {
  DEFAULT_WEB_SEARCH_PROVIDER_CACHE_TTL_MS,
  normalizeWebSearchProviderCacheTtlMs,
} from './webSearchProviderCachePolicy.mjs';

const DEFAULT_METADATA = Object.freeze({});
const DEFAULT_PURGE_LIMIT = 500;

function parseJsonValue(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function toDate(value, fallback = new Date()) {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeWebSearchProviderCacheRow(row) {
  if (!row) return null;
  return {
    cacheKey: row.cache_key,
    providerKey: row.provider_key,
    purpose: row.purpose,
    queryHash: row.query_hash,
    requestFingerprint: row.request_fingerprint,
    queryPreview: row.query_preview || null,
    response: validateWebSearchResponse(parseJsonValue(row.response, {})),
    resultCount: toInteger(row.result_count),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastHitAt: row.last_hit_at || null,
    hitCount: toInteger(row.hit_count),
    sourceRequestId: row.source_request_id || null,
    metadata: parseJsonValue(row.metadata, { ...DEFAULT_METADATA }),
  };
}

export class WebSearchProviderUsageCache {
  constructor({ db = defaultDb } = {}) {
    this.db = db;
  }

  withDb(db) {
    return new WebSearchProviderUsageCache({ db });
  }

  async getFreshResponse(cacheKey, { now = new Date() } = {}) {
    const result = await this.db.query(
      `SELECT *
         FROM web_search_provider_cache
        WHERE cache_key = $1
          AND expires_at > $2
        LIMIT 1`,
      [cacheKey, toDate(now)]
    );
    return normalizeWebSearchProviderCacheRow(result.rows[0]);
  }

  async storeResponse(input = {}, { now = new Date() } = {}) {
    const normalizedResponse = validateWebSearchResponse(input.response);
    const ttlMs = normalizeWebSearchProviderCacheTtlMs(input.ttlMs, {
      fallback: DEFAULT_WEB_SEARCH_PROVIDER_CACHE_TTL_MS,
    });
    const createdAt = toDate(now);
    const expiresAt = new Date(createdAt.getTime() + ttlMs);
    const metadata = input.metadata && typeof input.metadata === 'object'
      ? input.metadata
      : { ...DEFAULT_METADATA };

    const result = await this.db.query(
      `INSERT INTO web_search_provider_cache (
          cache_key,
          provider_key,
          purpose,
          query_hash,
          request_fingerprint,
          query_preview,
          response,
          result_count,
          expires_at,
          source_request_id,
          metadata,
          created_at,
          updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::jsonb, $12, $12)
       ON CONFLICT (cache_key) DO UPDATE
       SET
          response = EXCLUDED.response,
          result_count = EXCLUDED.result_count,
          expires_at = EXCLUDED.expires_at,
          source_request_id = EXCLUDED.source_request_id,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        input.cacheKey,
        input.providerKey,
        input.purpose,
        input.queryHash,
        input.requestFingerprint,
        input.queryPreview || null,
        JSON.stringify(normalizedResponse),
        normalizedResponse.results.length,
        expiresAt,
        normalizedResponse.providerRequestId || input.sourceRequestId || null,
        JSON.stringify(metadata),
        createdAt,
      ]
    );

    return normalizeWebSearchProviderCacheRow(result.rows[0]);
  }

  async recordHit(cacheKey, { now = new Date() } = {}) {
    const result = await this.db.query(
      `UPDATE web_search_provider_cache
          SET hit_count = hit_count + 1,
              last_hit_at = $2,
              updated_at = $2
        WHERE cache_key = $1
        RETURNING *`,
      [cacheKey, toDate(now)]
    );
    return normalizeWebSearchProviderCacheRow(result.rows[0]);
  }

  async deleteExpired({ now = new Date(), limit = DEFAULT_PURGE_LIMIT } = {}) {
    const purgeLimit = Math.max(1, Math.min(toInteger(limit, DEFAULT_PURGE_LIMIT), 5000));
    const result = await this.db.query(
      `DELETE FROM web_search_provider_cache
        WHERE cache_key IN (
          SELECT cache_key
            FROM web_search_provider_cache
           WHERE expires_at <= $1
           ORDER BY expires_at ASC
           LIMIT $2
        )
        RETURNING cache_key`,
      [toDate(now), purgeLimit]
    );
    return result.rows.map((row) => row.cache_key);
  }
}

export const webSearchProviderUsageCache = new WebSearchProviderUsageCache();
