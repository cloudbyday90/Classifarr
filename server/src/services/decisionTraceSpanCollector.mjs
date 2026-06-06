/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { performance } from 'node:perf_hooks';
import { createDecisionChildSpanContext, serializeDecisionTraceContext } from './decisionTraceContext.mjs';

export const DECISION_TRACE_SPAN_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_STAGE_SPANS = 16;
export const DEFAULT_MAX_SPAN_ATTRIBUTES = 12;

const SAFE_STAGE_NAMES = new Set([
  'gate',
  'enrichment',
  'retrieval_pass2',
  'policy_recheck',
  'ai_rerun',
  'rag_candidate',
  'trace',
]);

function sanitizeStageName(value) {
  return SAFE_STAGE_NAMES.has(value) ? value : 'trace';
}

function sanitizeString(value, maxLength = 120) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/[\r\n\t]/g, ' ').trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function sanitizeScalar(value) {
  if (typeof value === 'string') {
    return sanitizeString(value, 120);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function sanitizeAttributes(attributes = {}, maxAttributes = DEFAULT_MAX_SPAN_ATTRIBUTES) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return {};
  }

  const entries = Object.entries(attributes)
    .filter(([key]) => /^[a-z0-9_.-]{1,80}$/i.test(key))
    .slice(0, Math.max(0, Number(maxAttributes) || DEFAULT_MAX_SPAN_ATTRIBUTES));

  return Object.fromEntries(
    entries
      .map(([key, value]) => [key, sanitizeScalar(value)])
      .filter(([, value]) => value !== null),
  );
}

function statusFromOutcome(outcome) {
  if (outcome === 'error') return 'error';
  if (outcome === 'skipped') return 'unset';
  return 'ok';
}

export function createDecisionTraceSpanCollector(rootContext, options = {}) {
  const traceContext = serializeDecisionTraceContext(rootContext);
  const maxSpans = Math.max(1, Math.min(64, Number(options.maxSpans || DEFAULT_MAX_STAGE_SPANS)));
  const maxAttributes = Math.max(0, Math.min(32, Number(options.maxAttributes || DEFAULT_MAX_SPAN_ATTRIBUTES)));
  const traceStartedAt = performance.now();
  const activeSpans = new Map();
  const completedSpans = [];
  let truncated = false;

  const startStage = (stageName, attributes = {}) => {
    const name = sanitizeStageName(stageName);
    if (activeSpans.has(name)) {
      return activeSpans.get(name);
    }

    const spanContext = createDecisionChildSpanContext(traceContext);
    const span = {
      schema_version: DECISION_TRACE_SPAN_SCHEMA_VERSION,
      name,
      trace_id: spanContext.trace_id,
      span_id: spanContext.span_id,
      parent_span_id: spanContext.parent_span_id,
      traceparent: spanContext.traceparent,
      start_offset_ms: Math.max(0, Math.round(performance.now() - traceStartedAt)),
      started_at: new Date().toISOString(),
      attributes: sanitizeAttributes(attributes, maxAttributes),
      _start: performance.now(),
    };
    activeSpans.set(name, span);
    return span;
  };

  const finishStage = (stageName, details = {}) => {
    const name = sanitizeStageName(stageName);
    const span = activeSpans.get(name) || startStage(name);
    activeSpans.delete(name);

    const durationMs = Math.max(0, Math.round(performance.now() - span._start));
    const attributes = sanitizeAttributes({
      ...span.attributes,
      ...(details.attributes || {}),
    }, maxAttributes);
    const finished = {
      schema_version: DECISION_TRACE_SPAN_SCHEMA_VERSION,
      name,
      trace_id: span.trace_id,
      span_id: span.span_id,
      parent_span_id: span.parent_span_id,
      traceparent: span.traceparent,
      start_offset_ms: span.start_offset_ms,
      duration_ms: durationMs,
      outcome: sanitizeString(details.outcome, 80) || 'completed',
      reason_code: sanitizeString(details.reasonCode || details.reason_code, 120),
      status: sanitizeString(details.status, 40) || statusFromOutcome(details.outcome),
      attributes,
    };

    if (completedSpans.length < maxSpans) {
      completedSpans.push(finished);
    } else {
      truncated = true;
    }

    return finished;
  };

  const getActiveSpan = (stageName) => activeSpans.get(sanitizeStageName(stageName)) || null;
  const getActiveSpanId = (stageName) => getActiveSpan(stageName)?.span_id || null;

  const toJSON = () => ({
    schema_version: DECISION_TRACE_SPAN_SCHEMA_VERSION,
    root_span_id: traceContext.root_span_id,
    total_duration_ms: Math.max(0, Math.round(performance.now() - traceStartedAt)),
    truncated,
    spans: completedSpans.map((span) => ({ ...span, attributes: { ...span.attributes } })),
  });

  return {
    startStage,
    finishStage,
    getActiveSpan,
    getActiveSpanId,
    toJSON,
  };
}

