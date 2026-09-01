/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { getDataRequest } from './core'

const REVIEW_CORPUS_CAPTURE_EVALUATION_PATH =
  '/policies/candidate-correction/review-corpus/captured-outcomes/evaluation'

/** Reads the fixed aggregate-only future-capture evaluation with no filters. */
export function getPolicyCandidateCorrectionReviewCorpusCaptureEvaluation() {
  return getDataRequest(REVIEW_CORPUS_CAPTURE_EVALUATION_PATH)
}

const policyReviewCorpusCaptureEvaluationApi = {
  getPolicyCandidateCorrectionReviewCorpusCaptureEvaluation,
}

export default policyReviewCorpusCaptureEvaluationApi
