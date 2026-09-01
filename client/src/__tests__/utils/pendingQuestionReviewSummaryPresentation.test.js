/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPendingQuestionReviewSummaryPresentation,
} from '@/utils/pendingQuestionReviewSummaryPresentation'

describe('pendingQuestionReviewSummaryPresentation', () => {
  it('creates a concise, action-oriented summary for a confirmable destination', () => {
    expect(getPendingQuestionReviewSummaryPresentation({
      destination: { library_name: 'Movies' },
      canConfirmDestination: true,
      canChangeDestination: true,
    })).toEqual({
      heading: 'Recommendation',
      destination_label: 'Recommended destination',
      destination: 'Movies',
      review_label: 'Why this needs your review',
      review_message: 'Classifarr recommends Movies, but this review has not authorized an automatic route.',
      action_label: 'What to do',
      action_message: 'Confirm Movies to route this item, or choose a different destination.',
    })
  })

  it('falls back to a bounded manual-selection instruction without trusting a malformed name', () => {
    const presentation = getPendingQuestionReviewSummaryPresentation({
      destination: { library_name: '   ' },
      canChangeDestination: true,
    })

    expect(presentation.destination).toBe('No destination is recommended yet.')
    expect(presentation.action_message).toBe('Choose the destination that should receive this item.')
  })
})
