/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { apiClient, getDataRequest } from './core'

const REVIEW_CORPUS_CONTROL_PATH = '/policies/candidate-correction/review-corpus'

export function getPolicyCandidateCorrectionReviewCorpusControlConfiguration() {
  return getDataRequest(`${REVIEW_CORPUS_CONTROL_PATH}/configuration`)
}

export function acknowledgePolicyCandidateCorrectionReviewCorpusControl(configuration) {
  return apiClient.put(`${REVIEW_CORPUS_CONTROL_PATH}/configuration`, configuration)
}

export function getPolicyCandidateCorrectionReviewCorpusAuditEvents(limit = 5) {
  return getDataRequest(`${REVIEW_CORPUS_CONTROL_PATH}/audit-events`, {
    params: { limit },
  })
}

const policyReviewCorpusControlApi = {
  getPolicyCandidateCorrectionReviewCorpusControlConfiguration,
  acknowledgePolicyCandidateCorrectionReviewCorpusControl,
  getPolicyCandidateCorrectionReviewCorpusAuditEvents,
}

export default policyReviewCorpusControlApi
