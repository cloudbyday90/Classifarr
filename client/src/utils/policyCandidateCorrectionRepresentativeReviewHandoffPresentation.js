/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const SUSTAINED_REVIEW_SIGNAL = 'sustained_review_signal'

const SUSTAINED_REVIEW_HANDOFF = Object.freeze({
  heading: 'Representative decision review is ready',
  message: 'Two comparable 28-day aggregate periods met the existing review criterion. Open current Needs Attention decisions to inspect representative cases before considering any maintenance.',
  linkLabel: 'Open Needs Attention decisions',
  description: 'Opens the existing operator review workflow. No analytics filters, media identifiers, policy details, or automated changes are carried with this link.',
  announcement: 'Representative decision review is available in Needs Attention.',
  to: Object.freeze({
    name: 'CommandCenter',
    hash: '#needs-attention',
  }),
})

/**
 * Deliberately exposes only one static navigation destination for the one
 * server-derived state that warrants a representative manual review. This is
 * not an action, query, selection, or authorization mechanism.
 */
export function getPolicyCandidateCorrectionRepresentativeReviewHandoff(statusId) {
  return statusId === SUSTAINED_REVIEW_SIGNAL ? SUSTAINED_REVIEW_HANDOFF : null
}
