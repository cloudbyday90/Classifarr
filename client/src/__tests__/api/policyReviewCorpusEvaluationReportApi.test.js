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

const getDataRequest = vi.fn()

vi.mock('../../api/core', () => ({ getDataRequest }))

const {
  getPolicyCandidateCorrectionReviewCorpusEvaluationReport,
} = await import('../../api/policyReviewCorpusEvaluationReportApi')

describe('policy review-corpus evaluation-report API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses a fixed GET endpoint with no caller-selected records or filters', () => {
    getPolicyCandidateCorrectionReviewCorpusEvaluationReport()
    expect(getDataRequest).toHaveBeenCalledWith('/policies/candidate-correction/review-corpus/evaluation-report')
  })
})
