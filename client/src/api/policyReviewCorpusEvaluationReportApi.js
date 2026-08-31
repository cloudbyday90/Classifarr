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

const REVIEW_CORPUS_EVALUATION_REPORT_PATH = '/policies/candidate-correction/review-corpus/evaluation-report'

/** Reads the server-built aggregate report. It accepts no caller-selected filters. */
export function getPolicyCandidateCorrectionReviewCorpusEvaluationReport() {
  return getDataRequest(REVIEW_CORPUS_EVALUATION_REPORT_PATH)
}

const policyReviewCorpusEvaluationReportApi = {
  getPolicyCandidateCorrectionReviewCorpusEvaluationReport,
}

export default policyReviewCorpusEvaluationReportApi
