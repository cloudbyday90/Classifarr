/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiClient = { post: vi.fn() }
const getDataRequest = vi.fn()

vi.mock('../../api/core', () => ({ apiClient, getDataRequest }))

const {
  createPolicyCandidateCorrectionReviewCorpusProjection,
  getPolicyCandidateCorrectionReviewCorpusProjection,
} = await import('../../api/policyReviewCorpusProjectionApi')

describe('policy review-corpus projection API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses named helpers without a caller-selected record, filter, or export payload', () => {
    getPolicyCandidateCorrectionReviewCorpusProjection()
    expect(getDataRequest).toHaveBeenCalledWith('/policies/candidate-correction/review-corpus/projection')

    createPolicyCandidateCorrectionReviewCorpusProjection()
    expect(apiClient.post).toHaveBeenCalledWith('/policies/candidate-correction/review-corpus/projection', {})
  })
})
