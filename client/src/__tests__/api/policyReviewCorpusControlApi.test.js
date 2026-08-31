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

const apiClient = { put: vi.fn() }
const getDataRequest = vi.fn()

vi.mock('../../api/core', () => ({ apiClient, getDataRequest }))

const {
  acknowledgePolicyCandidateCorrectionReviewCorpusControl,
  getPolicyCandidateCorrectionReviewCorpusAuditEvents,
  getPolicyCandidateCorrectionReviewCorpusControlConfiguration,
} = await import('../../api/policyReviewCorpusControlApi')

describe('policy review-corpus control API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses named API helpers for the bounded control endpoints', () => {
    getPolicyCandidateCorrectionReviewCorpusControlConfiguration()
    expect(getDataRequest).toHaveBeenCalledWith(
      '/policies/candidate-correction/review-corpus/configuration',
    )

    getPolicyCandidateCorrectionReviewCorpusAuditEvents(10)
    expect(getDataRequest).toHaveBeenCalledWith(
      '/policies/candidate-correction/review-corpus/audit-events',
      { params: { limit: 10 } },
    )
  })

  it('sends only the caller-provided acknowledgement payload to the control endpoint', () => {
    const payload = {
      expected_revision: null,
      acknowledged_safeguard_ids: ['authorization', 'redaction', 'retention', 'operator_audit'],
      review_record_retention_days: 30,
    }

    acknowledgePolicyCandidateCorrectionReviewCorpusControl(payload)

    expect(apiClient.put).toHaveBeenCalledWith(
      '/policies/candidate-correction/review-corpus/configuration',
      payload,
    )
  })
})
