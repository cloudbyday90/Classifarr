/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_OBSERVED_SUGGESTION_COMMAND_PLAN_VERSION = 'policy.observed_suggestion_command_plan.v1'

const SELECTABLE_SOURCE_ID = 'suggested_from_observed_profile'
const PURPOSE_QUESTION_ID = 'what_belongs_here'
const SUPPORTED_PURPOSE_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios'])
const MAX_ACCEPTED_SUGGESTIONS = 20

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function replaceControlCharacters(value) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127 ? ' ' : character
  }).join('')
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''

  return replaceControlCharacters(String(value).normalize('NFKC'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)
}

function normalizeCandidate(candidate = {}) {
  const candidateId = normalizeString(candidate.candidateId, 220)
  const value = normalizeString(candidate.value, 120)
  const signalType = normalizeString(candidate.signalType, 80)
  const operator = normalizeString(candidate.operator, 80)
  const questionId = normalizeString(candidate.questionId, 120)
  const sourceId = normalizeString(candidate.sourceId, 120)
  const explanation = normalizeString(candidate.explanation, 320)

  if (
    !candidateId
    || !value
    || !SUPPORTED_PURPOSE_SIGNAL_TYPES.has(signalType)
    || operator !== 'require_any'
    || questionId !== PURPOSE_QUESTION_ID
    || sourceId !== SELECTABLE_SOURCE_ID
    || candidate.requiresExplicitAcceptance !== true
    || candidate.canAutoDeclare !== false
  ) {
    return null
  }

  return {
    candidateId,
    value,
    label: normalizeString(candidate.label, 160) || value,
    signalType,
    operator,
    questionId,
    sourceId,
    explanation,
    evidenceCount: Math.max(0, Number.parseInt(candidate.evidenceCount, 10) || 0),
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
  }
}

function normalizeAcceptedCandidates(candidates = []) {
  const uniqueCandidates = new Map()

  asArray(candidates).forEach((candidate) => {
    const normalizedCandidate = normalizeCandidate(candidate)
    if (normalizedCandidate && !uniqueCandidates.has(normalizedCandidate.candidateId)) {
      uniqueCandidates.set(normalizedCandidate.candidateId, normalizedCandidate)
    }
  })

  return Array.from(uniqueCandidates.values()).slice(0, MAX_ACCEPTED_SUGGESTIONS)
}

function buildObservedSuggestionCommandPlan({ commandId, candidates = [] } = {}) {
  const normalizedCandidates = normalizeAcceptedCandidates(candidates)
  const normalizedCommandId = normalizeString(commandId, 40)

  if (!['add_signal_value', 'remove_signal_value'].includes(normalizedCommandId)) {
    return null
  }

  return {
    version: POLICY_OBSERVED_SUGGESTION_COMMAND_PLAN_VERSION,
    commandBoundary: 'typed_draft_commands',
    commands: normalizedCandidates.map(candidate => ({
      commandId: normalizedCommandId,
      candidate,
    })),
  }
}

function applyObservedSuggestionCommandPlan(currentCandidates = [], commandPlan = {}) {
  if (
    commandPlan?.version !== POLICY_OBSERVED_SUGGESTION_COMMAND_PLAN_VERSION
    || commandPlan?.commandBoundary !== 'typed_draft_commands'
  ) {
    return normalizeAcceptedCandidates(currentCandidates)
  }

  const nextCandidates = new Map(
    normalizeAcceptedCandidates(currentCandidates).map(candidate => [candidate.candidateId, candidate])
  )

  asArray(commandPlan.commands).forEach((command) => {
    const candidate = normalizeCandidate(command?.candidate)
    if (!candidate) return

    if (command.commandId === 'add_signal_value') {
      nextCandidates.set(candidate.candidateId, candidate)
    }

    if (command.commandId === 'remove_signal_value') {
      nextCandidates.delete(candidate.candidateId)
    }
  })

  return Array.from(nextCandidates.values()).slice(0, MAX_ACCEPTED_SUGGESTIONS)
}

function buildDeclaredIntentFromObservedSuggestions(candidates = []) {
  const groupedValues = new Map()

  normalizeAcceptedCandidates(candidates).forEach((candidate) => {
    const values = groupedValues.get(candidate.signalType) || new Set()
    values.add(candidate.value)
    groupedValues.set(candidate.signalType, values)
  })

  const purpose = Array.from(groupedValues.entries()).map(([signalType, values]) => ({
    signal_type: signalType,
    operator: 'require_any',
    values: {
      require_any: Array.from(values),
    },
  }))

  if (purpose.length === 0) return null

  return {
    purpose,
    hard_limits: [],
    helpful_hints: [],
    avoid: [],
  }
}

export {
  MAX_ACCEPTED_SUGGESTIONS,
  applyObservedSuggestionCommandPlan,
  buildDeclaredIntentFromObservedSuggestions,
  buildObservedSuggestionCommandPlan,
  normalizeAcceptedCandidates,
}
