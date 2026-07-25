/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const PERSISTENCE_VERSION = 'policy.runtime_question_persistence.v1'
const REDUCTION_VERSION = 'policy.runtime_question_reduction.v1'
const RESOLVE_CURRENT_ITEM = 'resolve_current_item'
const DO_NOT_LEARN = 'do_not_learn'

function normalizeString(value, maxLength = 160) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= maxLength ? normalized : null
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function findOutcomeOption(question, outcomeId) {
  const options = Array.isArray(question?.options) ? question.options : []
  const optionIndex = options.findIndex(option => option?.outcomeId === outcomeId)
  if (optionIndex < 0) return null

  const option = options[optionIndex]
  const selectedOptionLabel = normalizeString(option?.label, 80)
  return selectedOptionLabel ? { option, optionIndex, selectedOptionLabel } : null
}

export function isNativePendingQuestion(question = {}) {
  return question?.version === PERSISTENCE_VERSION &&
    question?.runtimeQuestion?.contractVersion === REDUCTION_VERSION &&
    question?.runtimeQuestionReductionPlan?.version === REDUCTION_VERSION
}

/**
 * Keeps native question rendering declarative. This projection never decides
 * whether a resolution is valid; the API remains the authority for that.
 */
export function buildNativePendingQuestionPresentation(question = {}) {
  if (!isNativePendingQuestion(question)) return null

  const destination = question.meta?.runtime_question_persistence || {}
  const libraryId = normalizePositiveInteger(destination.destinationLibraryId)
  const libraryName = normalizeString(destination.destinationLibraryName)
  const resolveCurrentItem = findOutcomeOption(question, RESOLVE_CURRENT_ITEM)
  const doNotLearn = findOutcomeOption(question, DO_NOT_LEARN)

  if (!libraryId || !libraryName || !resolveCurrentItem || !doNotLearn) return null
  if (normalizePositiveInteger(resolveCurrentItem.option.library_id) !== libraryId) return null

  return {
    destination: { libraryId, libraryName },
    actions: [
      {
        id: RESOLVE_CURRENT_ITEM,
        label: `Resolve in ${libraryName}`,
        option: resolveCurrentItem.option,
        optionIndex: resolveCurrentItem.optionIndex,
        selectedOptionLabel: resolveCurrentItem.selectedOptionLabel,
        variant: 'success',
      },
      {
        id: DO_NOT_LEARN,
        label: 'Resolve without learning',
        option: doNotLearn.option,
        optionIndex: doNotLearn.optionIndex,
        selectedOptionLabel: doNotLearn.selectedOptionLabel,
        variant: 'secondary',
      },
    ],
    alternativeDestination: {
      label: 'Choose another destination',
      selectedOptionLabel: 'Choose another destination',
    },
  }
}
