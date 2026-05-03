/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { normalizeSqlState } = require('./db.shared');
const {
  clamp,
  sanitizeTraceEvent,
  sanitizeTraceMode,
  sanitizeTraceReason,
  sanitizeTraceTrigger,
  toNumber,
  TRACE_VERSION,
} = require('./shared.shared');

function truncateTrace(trace, maxEvents, maxBytes) {
  const safeMaxEvents = clamp(toNumber(maxEvents, 20), 1, 200);
  const safeMaxBytes = clamp(toNumber(maxBytes, 16384), 256, 131072);
  const trimmed = { ...trace };

  if (Array.isArray(trimmed.events) && trimmed.events.length > safeMaxEvents) {
    trimmed.events = trimmed.events.slice(0, safeMaxEvents);
    trimmed.events.push({
      stage: 'trace',
      outcome: 'truncated',
      reason: 'max_events',
      reason_code: 'max_events',
      fallback_action: 'trace_omitted',
      recoverable: true,
      sql_state: null,
    });
  }

  let serialized = JSON.stringify(trimmed);
  while (serialized.length > safeMaxBytes && Array.isArray(trimmed.events) && trimmed.events.length > 0) {
    trimmed.events = trimmed.events.slice(0, trimmed.events.length - 1);
    serialized = JSON.stringify(trimmed);
  }

  if (serialized.length > safeMaxBytes) {
    return {
      trace_version: TRACE_VERSION,
      mode: sanitizeTraceMode(trimmed.mode),
      ran: false,
      decision: {
        outcome: 'trace_truncated',
        reason: 'max_bytes',
      },
      events: [],
    };
  }

  return trimmed;
}

function buildRagLoopTrace({
  mode = 'shadow',
  ran = false,
  trigger = null,
  strategy = null,
  events = [],
  pass1Diagnostics = {},
  pass2Diagnostics = {},
  comparison = null,
  resolution = null,
  learning = null,
  timing = {},
  traceConfig = {},
} = {}) {
  const normalizedEvents = Array.isArray(events)
    ? events.map((event) => sanitizeTraceEvent(event, normalizeSqlState))
    : [];
  const normalizedMode = sanitizeTraceMode(mode);
  const normalizedStrategy = sanitizeTraceReason(strategy, null);
  const normalizedTrigger = sanitizeTraceTrigger(trigger);

  const trace = {
    trace_version: TRACE_VERSION,
    mode: normalizedMode,
    ran,
    trigger: normalizedTrigger,
    strategy: normalizedStrategy,
    diagnostics: {
      pass1: {
        match_count: toNumber(pass1Diagnostics.matchCount, 0),
        top_similarity: toNumber(pass1Diagnostics.topSimilarity, 0),
        margin_points: toNumber(pass1Diagnostics.marginPoints, 0),
      },
      pass2: {
        match_count: toNumber(pass2Diagnostics.matchCount, 0),
        top_similarity: toNumber(pass2Diagnostics.topSimilarity, 0),
        margin_points: toNumber(pass2Diagnostics.marginPoints, 0),
      },
    },
    decision: {
      outcome: sanitizeTraceReason(resolution?.source, 'baseline'),
      reason: sanitizeTraceReason(resolution?.reason, ran ? 'no_change' : 'not_ran'),
      comparator: sanitizeTraceReason(comparison?.reason, null),
    },
    learning: learning && typeof learning === 'object'
      ? {
        eligible: learning.eligible === true,
        reason: sanitizeTraceReason(learning.reason, null),
      }
      : null,
    timing_ms: {
      total: toNumber(timing.total, 0),
    },
    events: normalizedEvents,
  };

  return truncateTrace(trace, traceConfig.maxEvents, traceConfig.maxBytes);
}

module.exports = {
  buildRagLoopTrace,
};
