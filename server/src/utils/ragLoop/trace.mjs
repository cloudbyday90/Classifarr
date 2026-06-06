/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { normalizeSqlState } from './db.mjs';
import {
  clamp,
  sanitizeTraceEvent,
  sanitizeTraceMode,
  sanitizeTraceReason,
  sanitizeTraceTrigger,
  toNumber,
  TRACE_VERSION,
} from './shared.mjs';
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

function sanitizeString(value, maxLength = 160) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/[\r\n\t]/g, ' ').trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function sanitizeEvidenceMatch(match, pass) {
  if (!match || typeof match !== 'object') {
    return null;
  }

  return {
    pass,
    title: sanitizeString(match.title),
    year: Number.isFinite(Number(match.year)) ? Number(match.year) : null,
    library_id: match.libraryId ?? match.library_id ?? null,
    library_name: sanitizeString(match.libraryName || match.library_name, 120),
    similarity: toNumber(match.similarity, 0),
    text_similarity: match.textSimilarity == null && match.text_similarity == null
      ? null
      : toNumber(match.textSimilarity ?? match.text_similarity, 0),
    image_similarity: match.imageSimilarity == null && match.image_similarity == null
      ? null
      : toNumber(match.imageSimilarity ?? match.image_similarity, 0),
  };
}

function summarizeLibraryEvidence(matches = []) {
  const grouped = new Map();
  for (const match of matches) {
    const libraryId = match?.library_id ?? null;
    if (libraryId == null) {
      continue;
    }
    const key = String(libraryId);
    if (!grouped.has(key)) {
      grouped.set(key, {
        library_id: libraryId,
        library_name: match.library_name || null,
        count: 0,
        max_similarity: 0,
      });
    }
    const entry = grouped.get(key);
    entry.count += 1;
    entry.max_similarity = Math.max(entry.max_similarity, toNumber(match.similarity, 0));
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.count - a.count || b.max_similarity - a.max_similarity)
    .slice(0, 10);
}

function sanitizeRetrievalEvidence(retrievalEvidence = null) {
  if (!retrievalEvidence || typeof retrievalEvidence !== 'object') {
    return null;
  }

  const pass1 = (Array.isArray(retrievalEvidence.pass1) ? retrievalEvidence.pass1 : [])
    .slice(0, 5)
    .map((match) => sanitizeEvidenceMatch(match, 'pass1'))
    .filter(Boolean);
  const pass2 = (Array.isArray(retrievalEvidence.pass2) ? retrievalEvidence.pass2 : [])
    .slice(0, 5)
    .map((match) => sanitizeEvidenceMatch(match, 'pass2'))
    .filter(Boolean);

  if (pass1.length === 0 && pass2.length === 0) {
    return null;
  }

  return {
    schema_version: 1,
    pass1,
    pass2,
    library_counts: {
      pass1: summarizeLibraryEvidence(pass1),
      pass2: summarizeLibraryEvidence(pass2),
    },
  };
}

export function buildRagLoopTrace({
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
  retrievalEvidence = null,
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
    retrieval_evidence: sanitizeRetrievalEvidence(retrievalEvidence),
    events: normalizedEvents,
  };
  return truncateTrace(trace, traceConfig.maxEvents, traceConfig.maxBytes);
}
