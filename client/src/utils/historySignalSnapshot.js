/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const SIGNAL_METHODS = new Set([
  'policy_engine',
  'policy_auto',
  'policy_prompt',
  'policy_confirm',
  'policy_recheck',
  'ai_analysis',
  'ai_fallback',
  'ai_verified',
  'ai_rerun',
  'signal_calculation',
  'rule_match',
])

const FINAL_OUTCOME_METHODS = new Set([
  'manual_classification',
  'manual_correction',
  'source_library',
])

const SIGNAL_TYPES = ['preset', 'profile', 'pattern', 'rag', 'history']

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const hasPositiveSignalScores = (scores) => {
  return Boolean(scores && typeof scores === 'object' && SIGNAL_TYPES.some(type => Number(scores[type]) > 0))
}

export const formatPercentValue = (value) => {
  const number = toFiniteNumber(value)
  return number == null ? 'n/a' : `${Math.round(number)}%`
}

export const resolveSignalSnapshotScore = ({ selectedItem = null, details = null, hasFinalOutcome = false } = {}) => {
  const rankedCandidates = Array.isArray(details?.ranked_candidates) ? details.ranked_candidates : []
  const candidates = [
    details?.calculated_confidence,
    details?.confidence,
    details?.top_candidate?.score,
    details?.topCandidate?.score,
    rankedCandidates[0]?.score,
  ]

  if (!hasFinalOutcome) {
    candidates.push(selectedItem?.confidence)
  }

  for (const candidate of candidates) {
    const number = toFiniteNumber(candidate)
    if (number != null) {
      return number
    }
  }

  return null
}

export const selectSignalSnapshotEvent = ({ selectedItem = null, classificationEvents = [], snapshotScore = null } = {}) => {
  const events = Array.isArray(classificationEvents) ? classificationEvents : []
  const nonFinalSignalEvents = events.filter(event => event && event.is_final !== true && SIGNAL_METHODS.has(event.method))

  if (snapshotScore != null) {
    const scoreMatched = nonFinalSignalEvents.find(event => toFiniteNumber(event.confidence) === snapshotScore)
    if (scoreMatched) {
      return scoreMatched
    }
  }

  if (nonFinalSignalEvents.length > 0) {
    return nonFinalSignalEvents[nonFinalSignalEvents.length - 1]
  }

  if (selectedItem && !FINAL_OUTCOME_METHODS.has(selectedItem.method)) {
    return selectedItem
  }

  return null
}

export const buildSignalSnapshot = ({ selectedItem = null, metadata = null, classificationEvents = [] } = {}) => {
  const details = metadata?.classification_details || null
  const scores = details?.scores || null

  if (!hasPositiveSignalScores(scores)) {
    return {
      available: false,
      scores: null,
      weights: null,
      isOutcomeSeparated: false,
      score: null,
      sourceEvent: null,
    }
  }

  const events = Array.isArray(classificationEvents) ? classificationEvents : []
  const finalEvent = events.find(event => event?.is_final === true) || selectedItem || null
  const hasFinalOutcome = Boolean(finalEvent && FINAL_OUTCOME_METHODS.has(finalEvent.method))
  const score = resolveSignalSnapshotScore({ selectedItem, details, hasFinalOutcome })
  const sourceEvent = selectSignalSnapshotEvent({ selectedItem, classificationEvents: events, snapshotScore: score })
  const sourceEventId = sourceEvent?.id ?? null
  const finalEventId = finalEvent?.id ?? null
  const selectedMethodIsFinalOutcome = FINAL_OUTCOME_METHODS.has(selectedItem?.method)
  const isOutcomeSeparated = Boolean(
    selectedMethodIsFinalOutcome ||
    (sourceEventId != null && finalEventId != null && sourceEventId !== finalEventId)
  )

  return {
    available: true,
    scores,
    weights: details?.weights || null,
    isOutcomeSeparated,
    score,
    sourceEvent,
    finalEvent,
  }
}
