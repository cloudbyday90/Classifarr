/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'node:crypto';
import * as defaultDb from '../config/database.mjs';
import { normalizeWebSearchProviderKey } from './webSearchResultNormalizer.mjs';

export const WEB_SEARCH_ROUTE_DECISION_OUTCOMES = Object.freeze({
  SUCCESS: 'success',
  NO_PROVIDER: 'no_provider',
  FAILED: 'failed',
  ERROR: 'error',
});

const DEFAULT_PURPOSE = 'classification';
const DEFAULT_OPERATION = 'search';
const DEFAULT_METADATA = Object.freeze({});
const MAX_HISTORY_LIMIT = 50;
const MAX_CANDIDATE_COUNT = 20;
const MAX_ATTEMPT_COUNT = 20;

function toInteger(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNonNegativeInteger(value, fallback = null) {
  const parsed = toInteger(value, fallback);
  return parsed == null ? fallback : Math.max(0, parsed);
}

function toIsoTimestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNullableProviderKey(value) {
  if (!value) return null;
  const normalized = normalizeWebSearchProviderKey(value);
  return normalized === 'unknown' ? null : normalized;
}

function normalizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_METADATA };
  }
  const metadata = { ...value };
  delete metadata.apiKey;
  delete metadata.api_key;
  delete metadata.query;
  delete metadata.cacheKey;
  delete metadata.requestFingerprint;
  delete metadata.response;
  return metadata;
}

function normalizeQuota(quota = {}) {
  return {
    dailyLimit: toInteger(quota.dailyLimit),
    monthlyLimit: toInteger(quota.monthlyLimit),
    dailyCostUnits: toNonNegativeInteger(quota.dailyCostUnits, 0),
    monthlyCostUnits: toNonNegativeInteger(quota.monthlyCostUnits, 0),
    dailyRemaining: toInteger(quota.dailyRemaining),
    monthlyRemaining: toInteger(quota.monthlyRemaining),
  };
}

export function serializeWebSearchRouteCandidateForHistory(candidate = {}) {
  return {
    providerKey: candidate.providerKey || 'unknown',
    displayName: candidate.displayName || candidate.providerKey || 'Unknown provider',
    priority: toNonNegativeInteger(candidate.priority, 100),
    status: candidate.status || 'skipped',
    skipReason: candidate.skipReason || null,
    quota: normalizeQuota(candidate.quota),
  };
}

export function serializeWebSearchRouteAttemptForHistory(attempt = {}) {
  return {
    providerKey: attempt.providerKey || 'unknown',
    outcome: attempt.outcome || 'unknown',
    errorCode: attempt.errorCode || null,
    httpStatus: toInteger(attempt.httpStatus),
    retryAfterSeconds: toNonNegativeInteger(attempt.retryAfterSeconds),
  };
}

export function normalizeWebSearchRouteDecisionRow(row) {
  if (!row) return null;
  return {
    id: row.id == null ? null : Number(row.id),
    routeId: row.route_id,
    purpose: row.purpose,
    operation: row.operation,
    outcome: row.outcome,
    selectedProviderKey: row.selected_provider_key || null,
    finalProviderKey: row.final_provider_key || null,
    candidateCount: toNonNegativeInteger(row.candidate_count, 0),
    attemptCount: toNonNegativeInteger(row.attempt_count, 0),
    candidates: Array.isArray(row.candidates) ? row.candidates : [],
    attempts: Array.isArray(row.attempts) ? row.attempts : [],
    correlationId: row.correlation_id || null,
    classificationId: row.classification_id == null ? null : Number(row.classification_id),
    errorCode: row.error_code || null,
    errorHttpStatus: toInteger(row.error_http_status),
    durationMs: toNonNegativeInteger(row.duration_ms),
    metadata: normalizeMetadata(row.metadata),
    createdAt: toIsoTimestamp(row.created_at),
    completedAt: toIsoTimestamp(row.completed_at),
  };
}

export function getWebSearchRouteTraceContext(request = {}) {
  const traceContext = request.traceContext || {};
  return {
    purpose: request.purpose || traceContext.purpose || DEFAULT_PURPOSE,
    operation: traceContext.operation || DEFAULT_OPERATION,
    correlationId: traceContext.correlationId ? String(traceContext.correlationId).slice(0, 120) : null,
    classificationId: toInteger(traceContext.classificationId),
  };
}

function getDurationMs(startedAt, completedAt) {
  const started = startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime();
  const completed = completedAt instanceof Date ? completedAt.getTime() : new Date(completedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(completed)) return null;
  return Math.max(0, completed - started);
}

function normalizeOutcome(outcome) {
  return Object.values(WEB_SEARCH_ROUTE_DECISION_OUTCOMES).includes(outcome)
    ? outcome
    : WEB_SEARCH_ROUTE_DECISION_OUTCOMES.ERROR;
}

export class WebSearchProviderRouteHistory {
  constructor({ db = defaultDb, nowFn = () => new Date() } = {}) {
    this.db = db;
    this.nowFn = nowFn;
  }

  withDependencies(dependencies = {}) {
    return new WebSearchProviderRouteHistory({
      db: dependencies.db || this.db,
      nowFn: dependencies.nowFn || this.nowFn,
    });
  }

  async recordDecision(input = {}) {
    const trace = getWebSearchRouteTraceContext(input.request);
    const candidates = (input.candidates || [])
      .slice(0, MAX_CANDIDATE_COUNT)
      .map(serializeWebSearchRouteCandidateForHistory);
    const attempts = (input.attempts || [])
      .slice(0, MAX_ATTEMPT_COUNT)
      .map(serializeWebSearchRouteAttemptForHistory);
    const completedAt = input.completedAt || this.nowFn();
    const startedAt = input.startedAt || completedAt;
    const result = await this.db.query(
      `INSERT INTO web_search_provider_route_decisions (
          route_id,
          purpose,
          operation,
          outcome,
          selected_provider_key,
          final_provider_key,
          candidate_count,
          attempt_count,
          candidates,
          attempts,
          correlation_id,
          classification_id,
          error_code,
          error_http_status,
          duration_ms,
          metadata,
          created_at,
          completed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16::jsonb, $17, $18)
       RETURNING *`,
      [
        input.routeId || randomUUID(),
        trace.purpose,
        trace.operation,
        normalizeOutcome(input.outcome),
        toNullableProviderKey(input.selectedProviderKey),
        toNullableProviderKey(input.finalProviderKey),
        candidates.length,
        attempts.length,
        JSON.stringify(candidates),
        JSON.stringify(attempts),
        trace.correlationId,
        trace.classificationId,
        input.errorCode || null,
        toInteger(input.errorHttpStatus),
        toNonNegativeInteger(input.durationMs, getDurationMs(startedAt, completedAt)),
        JSON.stringify(normalizeMetadata(input.metadata)),
        startedAt,
        completedAt,
      ]
    );

    return normalizeWebSearchRouteDecisionRow(result.rows[0]);
  }

  async recordDecisionSafely(input = {}) {
    try {
      return await this.recordDecision(input);
    } catch {
      return null;
    }
  }

  async listRecentDecisions({ limit = 10, providerKey = null } = {}) {
    const boundedLimit = Math.max(1, Math.min(toInteger(limit, 10), MAX_HISTORY_LIMIT));
    const normalizedProviderKey = providerKey ? toNullableProviderKey(providerKey) : null;
    const params = [boundedLimit];
    let whereClause = '';
    if (normalizedProviderKey) {
      params.push(normalizedProviderKey);
      whereClause = `WHERE selected_provider_key = $2 OR final_provider_key = $2`;
    }

    const result = await this.db.query(
      `SELECT *
         FROM web_search_provider_route_decisions
         ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $1`,
      params
    );

    return result.rows.map(normalizeWebSearchRouteDecisionRow);
  }
}

export const webSearchProviderRouteHistory = new WebSearchProviderRouteHistory();
