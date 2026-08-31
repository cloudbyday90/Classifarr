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

const REVIEW_CORPUS_PROJECTION_PATH = '/policies/candidate-correction/review-corpus/projection'

export function getPolicyCandidateCorrectionReviewCorpusProjection() {
  return getDataRequest(REVIEW_CORPUS_PROJECTION_PATH)
}

export function createPolicyCandidateCorrectionReviewCorpusProjection() {
  return apiClient.post(REVIEW_CORPUS_PROJECTION_PATH, {})
}

const policyReviewCorpusProjectionApi = {
  getPolicyCandidateCorrectionReviewCorpusProjection,
  createPolicyCandidateCorrectionReviewCorpusProjection,
}

export default policyReviewCorpusProjectionApi
