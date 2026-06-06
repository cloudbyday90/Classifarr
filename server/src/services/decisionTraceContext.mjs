/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomBytes, randomUUID } from 'node:crypto';

export const DECISION_TRACE_SCHEMA_VERSION = 1;
export const TRACEPARENT_VERSION = '00';
export const DEFAULT_TRACE_FLAGS = '00';

const TRACE_ID_RE = /^[0-9a-f]{32}$/;
const SPAN_ID_RE = /^[0-9a-f]{16}$/;
const TRACE_FLAGS_RE = /^[0-9a-f]{2}$/;
const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ZERO_TRACE_ID = '0'.repeat(32);
const ZERO_SPAN_ID = '0'.repeat(16);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidTraceId(value) {
  return TRACE_ID_RE.test(value) && value !== ZERO_TRACE_ID;
}

function isValidSpanId(value) {
  return SPAN_ID_RE.test(value) && value !== ZERO_SPAN_ID;
}

function isValidTraceFlags(value) {
  return TRACE_FLAGS_RE.test(value);
}

function normalizeCorrelationId(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function randomHex(byteLength, isValid) {
  let value = randomBytes(byteLength).toString('hex');
  while (!isValid(value)) {
    value = randomBytes(byteLength).toString('hex');
  }
  return value;
}

function parseTraceparent(traceparent) {
  if (typeof traceparent !== 'string') {
    return null;
  }

  const match = traceparent.trim().match(TRACEPARENT_RE);
  if (!match) {
    return null;
  }

  const [, version, traceId, spanId, traceFlags] = match;
  if (version !== TRACEPARENT_VERSION || !isValidTraceId(traceId) || !isValidSpanId(spanId) || !isValidTraceFlags(traceFlags)) {
    return null;
  }

  return {
    traceId,
    parentSpanId: spanId,
    traceFlags,
  };
}

function pickTraceInput(input = {}) {
  if (!isPlainObject(input)) {
    return {};
  }

  const candidates = [
    input,
    input.parent,
    input.traceContext,
    input.trace_context,
    input.decisionTrace,
    input.decision_trace,
    input.ragLoopTrace?.trace_context,
    input.ragLoopLogContext,
  ].filter(isPlainObject);

  for (const candidate of candidates) {
    const parsed = parseTraceparent(candidate.traceparent);
    if (parsed) {
      return {
        ...parsed,
        correlationId: normalizeCorrelationId(candidate.correlation_id || candidate.correlationId),
      };
    }

    const traceId = candidate.trace_id || candidate.traceId || null;
    const spanId = candidate.span_id || candidate.spanId || candidate.root_span_id || candidate.rootSpanId || null;
    const traceFlags = candidate.trace_flags || candidate.traceFlags || DEFAULT_TRACE_FLAGS;
    if (isValidTraceId(traceId) && isValidSpanId(spanId) && isValidTraceFlags(traceFlags)) {
      return {
        traceId,
        parentSpanId: spanId,
        traceFlags,
        correlationId: normalizeCorrelationId(candidate.correlation_id || candidate.correlationId),
      };
    }
  }

  return {};
}

export function createDecisionTraceContext(input = {}) {
  const inherited = pickTraceInput(input);
  const traceId = inherited.traceId || randomHex(16, isValidTraceId);
  const rootSpanId = inherited.parentSpanId || randomHex(8, isValidSpanId);
  const traceFlags = inherited.traceFlags || DEFAULT_TRACE_FLAGS;

  return {
    schema_version: DECISION_TRACE_SCHEMA_VERSION,
    trace_id: traceId,
    root_span_id: rootSpanId,
    trace_flags: traceFlags,
    traceparent: `${TRACEPARENT_VERSION}-${traceId}-${rootSpanId}-${traceFlags}`,
    correlation_id: normalizeCorrelationId(input.correlationId || input.correlation_id) || inherited.correlationId || randomUUID(),
    source: input.source || 'classification',
  };
}

export function serializeDecisionTraceContext(context = {}) {
  const resolved = createDecisionTraceContext(context);
  return {
    schema_version: DECISION_TRACE_SCHEMA_VERSION,
    trace_id: resolved.trace_id,
    root_span_id: resolved.root_span_id,
    trace_flags: resolved.trace_flags,
    traceparent: resolved.traceparent,
    correlation_id: resolved.correlation_id,
    source: resolved.source,
  };
}

export function createDecisionChildSpanContext(parentContext = {}) {
  const parent = createDecisionTraceContext(parentContext);
  const spanId = randomHex(8, isValidSpanId);

  return {
    schema_version: DECISION_TRACE_SCHEMA_VERSION,
    trace_id: parent.trace_id,
    parent_span_id: parent.root_span_id,
    span_id: spanId,
    trace_flags: parent.trace_flags,
    traceparent: `${TRACEPARENT_VERSION}-${parent.trace_id}-${spanId}-${parent.trace_flags}`,
    correlation_id: parent.correlation_id,
  };
}

function compactStage(stage) {
  if (!isPlainObject(stage)) {
    return null;
  }

  const durationValue = stage.duration_ms ?? stage.durationMs;
  const startOffsetValue = stage.start_offset_ms ?? stage.startOffsetMs;
  return {
    name: stage.name || stage.stage || null,
    outcome: stage.outcome || stage.status || null,
    reason_code: stage.reason_code || stage.reasonCode || null,
    span_id: isValidSpanId(stage.span_id || stage.spanId || '') ? (stage.span_id || stage.spanId) : null,
    parent_span_id: isValidSpanId(stage.parent_span_id || stage.parentSpanId || '') ? (stage.parent_span_id || stage.parentSpanId) : null,
    linked_correlation_id: stage.linked_correlation_id || stage.correlationId || stage.correlation_id || null,
    status: stage.status || null,
    start_offset_ms: Number.isFinite(Number(startOffsetValue))
      ? Math.max(0, Math.round(Number(startOffsetValue)))
      : null,
    duration_ms: Number.isFinite(Number(durationValue))
      ? Math.max(0, Math.round(Number(durationValue)))
      : null,
  };
}

export function buildDecisionTraceMetadata({
  context = {},
  result = {},
  status = null,
  libraryId = null,
  libraryName = null,
  startedAt = null,
  completedAt = new Date(),
  processingTimeMs = null,
} = {}) {
  const traceContext = serializeDecisionTraceContext(
    context?.trace_id || context?.traceparent ? context : {
      trace_context: result.ragLoopTrace?.trace_context,
      ragLoopLogContext: result.ragLoopLogContext,
    },
  );
  const ragTrace = result.ragLoopTrace || null;
  const ragSummary = result.ragLoopSummary || null;
  const policyResult = result.policyResult || null;
  const topCandidate = Array.isArray(policyResult?.ranked) ? policyResult.ranked[0] : null;
  const spans = Array.isArray(ragTrace?.stage_spans)
    ? ragTrace.stage_spans
    : (Array.isArray(result.decisionTrace?.spans) ? result.decisionTrace.spans : []);

  const stages = [
    {
      name: 'classification',
      outcome: status,
      reason_code: result.method || null,
      span_id: traceContext.root_span_id,
      linked_correlation_id: traceContext.correlation_id,
      duration_ms: processingTimeMs,
    },
    {
      name: 'policy',
      outcome: policyResult ? (policyResult.action || 'evaluated') : 'not_recorded',
      reason_code: policyResult?.decisionDiagnostics?.reason_code || topCandidate?.candidate_diagnostics?.primary_viability || null,
      span_id: spans.find((span) => span?.name === 'policy_recheck')?.span_id || null,
      linked_correlation_id: null,
      duration_ms: spans.find((span) => span?.name === 'policy_recheck')?.duration_ms || null,
    },
    {
      name: 'rag_loop',
      outcome: ragTrace?.decision?.outcome || ragSummary?.decision_outcome || (ragTrace ? 'evaluated' : 'not_recorded'),
      reason_code: ragTrace?.decision?.reason || ragSummary?.decision_reason || null,
      span_id: ragTrace?.trace_context?.root_span_id || null,
      linked_correlation_id: result.ragLoopLogContext?.correlationId || ragTrace?.trace_context?.correlation_id || null,
      duration_ms: ragTrace?.timing_ms?.total || ragSummary?.timing_ms?.total || null,
    },
  ].map(compactStage).filter(Boolean);

  return {
    schema_version: DECISION_TRACE_SCHEMA_VERSION,
    trace_id: traceContext.trace_id,
    root_span_id: traceContext.root_span_id,
    trace_flags: traceContext.trace_flags,
    traceparent: traceContext.traceparent,
    correlation_id: traceContext.correlation_id,
    sampled: (Number.parseInt(traceContext.trace_flags, 16) & 1) === 1,
    source: traceContext.source,
    started_at: startedAt ? new Date(startedAt).toISOString() : null,
    completed_at: completedAt instanceof Date ? completedAt.toISOString() : new Date(completedAt).toISOString(),
    processing_time_ms: processingTimeMs,
    outcome: {
      status,
      method: result.method || null,
      confidence: result.confidence ?? null,
      library_id: libraryId,
      library_name: libraryName,
      needs_clarification: result.needs_clarification === true,
      needs_retry: result.needs_retry === true,
    },
    stages,
    spans: spans.slice(0, 16).map(compactStage).filter(Boolean),
  };
}

export const decisionTraceContext = {
  createDecisionTraceContext,
  createDecisionChildSpanContext,
  serializeDecisionTraceContext,
  buildDecisionTraceMetadata,
};
