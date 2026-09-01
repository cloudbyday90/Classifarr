/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

function boundedString(value, maximumLength = 160) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= maximumLength ? normalized : null
}

/**
 * Creates concise, local-only copy for a pending routing review. It accepts
 * only the normalized destination name and action availability; policy,
 * provider, retrieval, and model text stay outside this summary.
 */
export function getPendingQuestionReviewSummaryPresentation({
  destination,
  canConfirmDestination = false,
  canChangeDestination = false,
} = {}) {
  const destinationName = boundedString(destination?.library_name)

  if (!destinationName) {
    return {
      heading: 'Choose a destination',
      destination_label: 'Recommended destination',
      destination: 'No destination is recommended yet.',
      review_label: 'Why this needs your review',
      review_message: 'The available policy evidence does not identify one destination that can be routed automatically.',
      action_label: 'What to do',
      action_message: canChangeDestination
        ? 'Choose the destination that should receive this item.'
        : 'Retry classification to rebuild this review from the current policy state.',
    }
  }

  return {
    heading: 'Recommendation',
    destination_label: 'Recommended destination',
    destination: destinationName,
    review_label: 'Why this needs your review',
    review_message: `Classifarr recommends ${destinationName}, but this review has not authorized an automatic route.`,
    action_label: 'What to do',
    action_message: canConfirmDestination
      ? `Confirm ${destinationName} to route this item, or choose a different destination.`
      : canChangeDestination
        ? 'Choose a destination to continue. The current recommendation is not available to confirm.'
        : 'Retry classification to rebuild this review from the current policy state.',
  }
}
