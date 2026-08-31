/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { getDataRequest } from './core'

const POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_PATH =
  '/policies/candidate-correction/policy-change-review-history-summary'

/** Reads the server-owned, selector-free completed review-activity summary. */
export function getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary() {
  return getDataRequest(POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_PATH)
}

const policyChangeReviewHistorySummaryApi = {
  getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary,
}

export default policyChangeReviewHistorySummaryApi
