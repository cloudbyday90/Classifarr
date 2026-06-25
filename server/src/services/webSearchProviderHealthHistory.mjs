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
import { normalizeWebSearchProviderKey } from './webSearchResultNormalizer.mjs';

export const WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error',
  COOLDOWN_STARTED: 'cooldown_started',
});

export const WEB_SEARCH_PROVIDER_HEALTH_STATUSES = Object.freeze({
  AVAILABLE: 'available',
  DEGRADED: 'degraded',
  COOLDOWN: 'cooldown',
});

const DEFAULT_PURPOSE = 'classification';
const DEFAULT_OPERATION = 'search';
const MAX_HISTORY_LIMIT = 50;
const MAX_RETRY_AFTER_SECONDS = 86_400;
const SAFE_METADATA_KEYS = new Set([
  'cacheHit',
  'routedProvider',
]);

function toInteger(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNonNegativeInteger(value, fallback = null, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = toInteger(value, fallback);
  if (parsed == null) return fallback;
  return Math.max(0, Math.min(parsed, maximum));
}

function toBoundedString(value, fallback, maximumLength) {
  const normalized = String(value || fallback || '').trim();
  return (normalized || fallback).slice(0, maximumLength);
}

function toIsoTimestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNullableProviderKey(value) {
  const normalized = normalizeWebSearchProviderKey(value);
  return normalized === 'unknown' ? null : normalized;
}

function normalizeEventType(eventType) {
  return Object.values(WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES).includes(eventType)
    ? eventType
    : WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES.ERROR;
}

function normalizeHealthStatus(healthStatus) {
  return Object.values(WEB_SEARCH_PROVIDER_HEALTH_STATUSES).includes(healthStatus)
    ? healthStatus
    : WEB_SEARCH_PROVIDER_HEALTH_STATUSES.DEGRADED;
}

function normalizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return Object.fromEntries(Object.entries(metadata)
    .filter(([key]) => SAFE_METADATA_KEYS.has(key))
    .map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value).slice(0, 120)]));
}

export function normalizeWebSearchProviderHealthEventRow(row) {
  if (!row) return null;
  return {
    id: row.id == null ? null : Number(row.id),
    providerKey: row.provider_key,
    eventType: row.event_type,
    healthStatus: row.health_status,
    purpose: row.purpose,
    operation: row.operation,
    errorCode: row.error_code || null,
    errorHttpStatus: toInteger(row.error_http_status),
    retryAfterSeconds: toNonNegativeInteger(row.retry_after_seconds),
    cooldownUntil: toIsoTimestamp(row.cooldown_until),
    correlationId: row.correlation_id || null,
    classificationId: row.classification_id == null ? null : Number(row.classification_id),
    metadata: normalizeMetadata(row.metadata),
    createdAt: toIsoTimestamp(row.created_at),
  };
}

export function buildWebSearchProviderHealthEventFromUsage(providerKey, usage = {}, config = {}) {
  const error = usage.error || null;
  if (!error && usage.status === 'success') {
    return {
      providerKey,
      eventType: WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES.SUCCESS,
      healthStatus: WEB_SEARCH_PROVIDER_HEALTH_STATUSES.AVAILABLE,
      purpose: usage.purpose,
      operation: usage.operation,
      correlationId: usage.correlationId,
      classificationId: usage.classificationId,
      metadata: usage.metadata,
    };
  }

  if (!error) return null;

  const retryAfterSeconds = toNonNegativeInteger(error.retryAfterSeconds, null, MAX_RETRY_AFTER_SECONDS);
  const cooldownUntil = toIsoTimestamp(config.cooldownUntil);
  const eventType = error.cooldownEligible && (retryAfterSeconds != null || cooldownUntil)
    ? WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES.COOLDOWN_STARTED
    : WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES.ERROR;

  return {
    providerKey,
    eventType,
    healthStatus: eventType === WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES.COOLDOWN_STARTED
      ? WEB_SEARCH_PROVIDER_HEALTH_STATUSES.COOLDOWN
      : WEB_SEARCH_PROVIDER_HEALTH_STATUSES.DEGRADED,
    purpose: usage.purpose,
    operation: usage.operation || error.operation,
    errorCode: error.code,
    errorHttpStatus: error.httpStatus,
    retryAfterSeconds,
    cooldownUntil,
    correlationId: usage.correlationId,
    classificationId: usage.classificationId,
    metadata: usage.metadata,
  };
}

export class WebSearchProviderHealthHistory {
  constructor({ db = defaultDb } = {}) {
    this.db = db;
  }

  withDb(db) {
    return new WebSearchProviderHealthHistory({ db });
  }

  async recordEvent(input = {}) {
    const providerKey = toNullableProviderKey(input.providerKey);
    if (!providerKey) {
      throw new Error('Invalid web search provider key');
    }

    const result = await this.db.query(
      `INSERT INTO web_search_provider_health_events (
          provider_key,
          event_type,
          health_status,
          purpose,
          operation,
          error_code,
          error_http_status,
          retry_after_seconds,
          cooldown_until,
          correlation_id,
          classification_id,
          metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
       RETURNING *`,
      [
        providerKey,
        normalizeEventType(input.eventType),
        normalizeHealthStatus(input.healthStatus),
        toBoundedString(input.purpose, DEFAULT_PURPOSE, 60),
        toBoundedString(input.operation, DEFAULT_OPERATION, 60),
        input.errorCode ? String(input.errorCode).slice(0, 80) : null,
        toInteger(input.errorHttpStatus),
        toNonNegativeInteger(input.retryAfterSeconds, null, MAX_RETRY_AFTER_SECONDS),
        toIsoTimestamp(input.cooldownUntil),
        input.correlationId ? String(input.correlationId).slice(0, 120) : null,
        toInteger(input.classificationId),
        JSON.stringify(normalizeMetadata(input.metadata)),
      ]
    );

    return normalizeWebSearchProviderHealthEventRow(result.rows[0]);
  }

  async recordEventSafely(input = {}) {
    try {
      return await this.recordEvent(input);
    } catch {
      return null;
    }
  }

  async recordUsageEvent(providerKey, usage = {}, config = {}) {
    const event = buildWebSearchProviderHealthEventFromUsage(providerKey, usage, config);
    return event ? this.recordEvent(event) : null;
  }

  async recordUsageEventSafely(providerKey, usage = {}, config = {}) {
    try {
      return await this.recordUsageEvent(providerKey, usage, config);
    } catch {
      return null;
    }
  }

  async listRecentEvents({ limit = 10, providerKey = null } = {}) {
    const boundedLimit = Math.max(1, Math.min(toInteger(limit, 10), MAX_HISTORY_LIMIT));
    const normalizedProviderKey = providerKey ? toNullableProviderKey(providerKey) : null;
    const params = [boundedLimit];
    let whereClause = '';
    if (normalizedProviderKey) {
      params.push(normalizedProviderKey);
      whereClause = 'WHERE provider_key = $2';
    }

    const result = await this.db.query(
      `SELECT *
         FROM web_search_provider_health_events
         ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $1`,
      params
    );

    return result.rows.map(normalizeWebSearchProviderHealthEventRow);
  }
}

export const webSearchProviderHealthHistory = new WebSearchProviderHealthHistory();
