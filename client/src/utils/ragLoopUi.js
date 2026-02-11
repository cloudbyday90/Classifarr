/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function toPercentFromSimilarity(value) {
  const numeric = toFiniteNumber(value)
  if (!Number.isFinite(numeric)) return null
  if (numeric >= 0 && numeric <= 1) return Math.round(numeric * 100)
  if (numeric >= 0 && numeric <= 100) return Math.round(numeric)
  return null
}

export function parseClassificationMetadata(metadata) {
  if (!metadata) return null
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  return typeof metadata === 'object' ? metadata : null
}

export function getRagLoopTrace(metadata) {
  const parsed = parseClassificationMetadata(metadata)
  const trace = parsed?.classification_details?.rag_loop_trace
  return trace && typeof trace === 'object' ? trace : null
}

export function buildRagLoopTraceSummary(metadata, fallbackConfidence = null) {
  const trace = getRagLoopTrace(metadata)
  if (!trace) {
    return {
      hasTrace: false,
      mode: null,
      ran: false,
      trigger: null,
      strategy: null,
      decisionOutcome: null,
      decisionReason: null,
      beforeScorePercent: null,
      afterScorePercent: null,
      events: [],
      fallbackConfidence: toFiniteNumber(fallbackConfidence)
    }
  }

  const events = Array.isArray(trace.events)
    ? trace.events.map((event) => ({
      stage: event?.stage || 'unknown',
      outcome: event?.outcome || 'unknown',
      reason: event?.reason_code || event?.reason || null
    }))
    : []

  return {
    hasTrace: true,
    mode: typeof trace.mode === 'string' ? trace.mode : 'shadow',
    ran: trace.ran === true,
    trigger: typeof trace.trigger === 'string' ? trace.trigger : null,
    strategy: typeof trace.strategy === 'string' ? trace.strategy : null,
    decisionOutcome: typeof trace.decision?.outcome === 'string' ? trace.decision.outcome : 'baseline',
    decisionReason: typeof trace.decision?.reason === 'string'
      ? trace.decision.reason
      : (typeof trace.decision?.comparator === 'string' ? trace.decision.comparator : null),
    beforeScorePercent: toPercentFromSimilarity(trace.diagnostics?.pass1?.top_similarity),
    afterScorePercent: toPercentFromSimilarity(trace.diagnostics?.pass2?.top_similarity),
    events,
    fallbackConfidence: toFiniteNumber(fallbackConfidence)
  }
}

export function buildTargetedRecheckDiagnostic(metadata, fallbackConfidence = null) {
  const summary = buildRagLoopTraceSummary(metadata, fallbackConfidence)
  if (!summary.hasTrace) return null

  const beforeAfter = Number.isFinite(summary.beforeScorePercent) && Number.isFinite(summary.afterScorePercent)
    ? `${summary.beforeScorePercent}% -> ${summary.afterScorePercent}%`
    : 'before/after unavailable'
  const decision = summary.decisionOutcome === 'pass2'
    ? 'applied'
    : `skipped (${summary.decisionReason || 'baseline_preserved'})`
  const state = summary.ran ? 'ran' : 'skipped'

  return `Targeted re-check ${state}: ${beforeAfter}; ${decision}`
}
