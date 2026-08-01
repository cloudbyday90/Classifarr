/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_INTENT_SIGNAL_COMMAND_PLAN_VERSION = 'policy.intent_signal_command_plan.v1'

const INTENT_SIGNAL_PICKER_COMPONENT_ID = 'intent_signal_picker'
const PURPOSE_QUESTION_ID = 'what_belongs_here'
const SELECTABLE_SUGGESTION_STATE_ID = 'selectable_suggestion'
const SUPPORTED_PURPOSE_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios'])
const SUPPORTED_CANDIDATE_SOURCE_IDS = new Set([
  'suggested_from_observed_profile',
  'suggested_from_starter_template',
  'common_static_option',
  'operator_added_custom',
])
const MAX_ACCEPTED_SIGNALS = 20

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
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

function normalizeEvidence(value = {}) {
  const evidence = asObject(value)
  const count = Number(evidence.count)
  const confidence = Number(evidence.confidence)

  return {
    count: Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0,
    confidence: Number.isFinite(confidence)
      ? Math.max(0, Math.min(confidence, 1))
      : null,
  }
}

function normalizeIntentSignalPickerOption(candidate = {}) {
  const source = asObject(candidate)
  const candidateId = normalizeString(source.candidateId || source.key, 220)
  const value = normalizeString(source.value || source.label, 120)
  const sourceId = normalizeString(source.sourceId, 120)
  const selectionStateId = normalizeString(source.selectionStateId, 120)

  if (!candidateId || !value || !sourceId || !selectionStateId) return null

  return {
    candidateId,
    value,
    label: normalizeString(source.label, 160) || value,
    sourceId,
    sourceLabel: normalizeString(source.sourceLabel, 160),
    selectionStateId,
    selectable: source.selectable === true,
    readOnlyEvidence: source.readOnlyEvidence === true,
    requiresExplicitAcceptance: source.requiresExplicitAcceptance === true,
    canAutoDeclare: source.canAutoDeclare === true
      ? true
      : source.canAutoDeclare === false
        ? false
        : null,
    commandId: normalizeString(source.commandId, 80),
    signalType: normalizeString(source.signalType, 80),
    operator: normalizeString(source.operator, 80),
    questionId: normalizeString(source.questionId, 120),
    explanation: normalizeString(source.explanation, 320),
    disabledReason: normalizeString(source.disabledReason, 320),
    evidence: normalizeEvidence(source.evidence),
  }
}

function normalizeIntentSignalPickerOptions(options = []) {
  const uniqueOptions = new Map()

  asArray(options).forEach((option) => {
    const normalizedOption = normalizeIntentSignalPickerOption(option)
    if (normalizedOption && !uniqueOptions.has(normalizedOption.candidateId)) {
      uniqueOptions.set(normalizedOption.candidateId, normalizedOption)
    }
  })

  return Array.from(uniqueOptions.values()).slice(0, MAX_ACCEPTED_SIGNALS)
}

function normalizeIntentSignalCandidate(candidate = {}) {
  const option = normalizeIntentSignalPickerOption(candidate)

  if (
    !option
    || option.selectionStateId !== SELECTABLE_SUGGESTION_STATE_ID
    || option.selectable !== true
    || option.requiresExplicitAcceptance !== true
    || option.canAutoDeclare !== false
    || option.commandId !== 'add_signal_value'
    || !SUPPORTED_CANDIDATE_SOURCE_IDS.has(option.sourceId)
    || !SUPPORTED_PURPOSE_SIGNAL_TYPES.has(option.signalType)
    || option.operator !== 'require_any'
    || option.questionId !== PURPOSE_QUESTION_ID
    || !option.explanation
  ) {
    return null
  }

  return option
}

function normalizeIntentSignalCandidates(candidates = []) {
  const uniqueCandidates = new Map()

  asArray(candidates).forEach((candidate) => {
    const normalizedCandidate = normalizeIntentSignalCandidate(candidate)
    if (normalizedCandidate && !uniqueCandidates.has(normalizedCandidate.candidateId)) {
      uniqueCandidates.set(normalizedCandidate.candidateId, normalizedCandidate)
    }
  })

  return Array.from(uniqueCandidates.values()).slice(0, MAX_ACCEPTED_SIGNALS)
}

function buildIntentSignalCommandPlan({ commandId, candidates = [] } = {}) {
  const normalizedCandidates = normalizeIntentSignalCandidates(candidates)
  const normalizedCommandId = normalizeString(commandId, 40)

  if (!['add_signal_value', 'remove_signal_value'].includes(normalizedCommandId)) {
    return null
  }

  return {
    version: POLICY_INTENT_SIGNAL_COMMAND_PLAN_VERSION,
    componentId: INTENT_SIGNAL_PICKER_COMPONENT_ID,
    commandBoundary: 'typed_draft_commands',
    commandCount: normalizedCandidates.length,
    commands: normalizedCandidates.map(candidate => ({
      commandId: normalizedCommandId,
      candidate,
    })),
  }
}

function applyIntentSignalCommandPlan(currentCandidates = [], commandPlan = {}) {
  if (
    commandPlan?.version !== POLICY_INTENT_SIGNAL_COMMAND_PLAN_VERSION
    || commandPlan?.componentId !== INTENT_SIGNAL_PICKER_COMPONENT_ID
    || commandPlan?.commandBoundary !== 'typed_draft_commands'
  ) {
    return normalizeIntentSignalCandidates(currentCandidates)
  }

  const nextCandidates = new Map(
    normalizeIntentSignalCandidates(currentCandidates).map(candidate => [candidate.candidateId, candidate])
  )

  asArray(commandPlan.commands).forEach((command) => {
    const candidate = normalizeIntentSignalCandidate(command?.candidate)
    if (!candidate) return

    if (command.commandId === 'add_signal_value') {
      nextCandidates.set(candidate.candidateId, candidate)
    }

    if (command.commandId === 'remove_signal_value') {
      nextCandidates.delete(candidate.candidateId)
    }
  })

  return Array.from(nextCandidates.values()).slice(0, MAX_ACCEPTED_SIGNALS)
}

function buildDeclaredIntentFromIntentSignals(candidates = []) {
  const groupedValues = new Map()

  normalizeIntentSignalCandidates(candidates).forEach((candidate) => {
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
  MAX_ACCEPTED_SIGNALS,
  applyIntentSignalCommandPlan,
  buildDeclaredIntentFromIntentSignals,
  buildIntentSignalCommandPlan,
  normalizeIntentSignalCandidates,
  normalizeIntentSignalPickerOptions,
}
