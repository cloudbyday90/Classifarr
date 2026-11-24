/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ANSWER_OUTCOME_IDS } from './policyQuestionLearningVocabulary.mjs';
import {
  isPolicyRuntimeQuestionPersistenceEnvelope,
  readNativePendingQuestionDestination,
} from './policyRuntimeQuestionPersistenceContract.mjs';

const MAX_DESTINATION_NAME_LENGTH = 160;

function normalizeString(value, maxLength = 160) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function findOutcomeOption(question, outcomeId) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const optionIndex = options.findIndex(option => option?.outcomeId === outcomeId);
  if (optionIndex < 0) return null;

  const option = options[optionIndex];
  const label = normalizeString(option?.label, 80);
  return label ? { optionIndex, label } : null;
}

/**
 * Projects a canonical persisted runtime question into presentation-only native
 * resolution actions. The result contains no learning, persistence, provider,
 * routing, or authority decision; callers must still use the authoritative
 * resolver for every action.
 */
export function buildNativePendingQuestionPresentation(question = {}) {
  if (!isPolicyRuntimeQuestionPersistenceEnvelope(question)) {
    return null;
  }

  const destination = question.meta?.runtime_question_persistence || {};
  const resolvedDestination = readNativePendingQuestionDestination(question);
  const destinationLibraryName = normalizeString(
    destination.destinationLibraryName,
    MAX_DESTINATION_NAME_LENGTH,
  );
  const resolveLabel = normalizeString(resolvedDestination?.option.label, 80);
  const doNotLearn = findOutcomeOption(question, ANSWER_OUTCOME_IDS.DO_NOT_LEARN);

  if (!resolvedDestination || !destinationLibraryName || !resolveLabel || !doNotLearn) {
    return null;
  }

  return {
    destination: {
      libraryId: resolvedDestination.libraryId,
      libraryName: destinationLibraryName,
    },
    actions: [
      {
        id: ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
        label: `Resolve in ${destinationLibraryName}`,
        optionIndex: resolvedDestination.optionIndex,
        selectedOptionLabel: resolveLabel,
        style: 'success',
      },
      {
        id: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
        label: 'Resolve without learning',
        optionIndex: doNotLearn.optionIndex,
        selectedOptionLabel: doNotLearn.label,
        style: 'secondary',
      },
    ],
    alternativeDestination: {
      label: 'Choose another destination',
      selectedOptionLabel: 'Choose another destination',
    },
  };
}
