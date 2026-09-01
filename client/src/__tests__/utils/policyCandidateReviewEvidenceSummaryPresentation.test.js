/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyCandidateReviewEvidenceSummaryPresentation,
} from '@/utils/policyCandidateReviewEvidenceSummaryPresentation'

describe('policyCandidateReviewEvidenceSummaryPresentation', () => {
  it('converts fixed evidence identifiers into concise operator guidance', () => {
    const presentation = getPolicyCandidateReviewEvidenceSummaryPresentation({
      status_id: 'counter_evidence_recommended',
      sources: [{ id: 'observed_library_profile' }],
    }, {
      status_id: 'no_candidate_identity_match',
      label: 'Current inventory provides no cross-check',
      message: 'No viable candidate currently contains this exact stable item identity.',
    })

    expect(presentation).toMatchObject({
      label: 'This destination is plausible, but not proven',
      tone: 'attention',
      contrastive: {
        label: 'The exact-item check did not add evidence',
      },
    })
  })

  it('fails closed when no known evidence or bounded comparison is available', () => {
    expect(getPolicyCandidateReviewEvidenceSummaryPresentation(
      { status_id: 'untrusted_status', sources: [] },
      { status_id: 'untrusted_status' },
      null,
    )).toBeNull()
  })
})
