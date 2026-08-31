/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { apiClient, getDataRequest } from './core'

const POLICY_CHANGE_DECISION_RECORD_PATH =
  '/policies/candidate-correction/policy-change-decision-record'

/** Reads the current server-owned, selector-free reviewed-decision status. */
export function getPolicyCandidateCorrectionPolicyChangeDecisionRecord() {
  return getDataRequest(POLICY_CHANGE_DECISION_RECORD_PATH)
}

/** Saves the first fixed reviewed conclusion for the completed aggregate outcome. */
export function createPolicyCandidateCorrectionPolicyChangeDecisionRecord({ decisionId, rationaleId }) {
  return apiClient.post(POLICY_CHANGE_DECISION_RECORD_PATH, {
    decision_id: decisionId,
    rationale_id: rationaleId,
  })
}

/** Revises a conclusion only when the browser holds the current server revision. */
export function revisePolicyCandidateCorrectionPolicyChangeDecisionRecord({
  decisionId,
  rationaleId,
  expectedRevision,
}) {
  return apiClient.put(POLICY_CHANGE_DECISION_RECORD_PATH, {
    decision_id: decisionId,
    rationale_id: rationaleId,
    expected_revision: expectedRevision,
  })
}

const policyChangeDecisionRecordApi = {
  getPolicyCandidateCorrectionPolicyChangeDecisionRecord,
  createPolicyCandidateCorrectionPolicyChangeDecisionRecord,
  revisePolicyCandidateCorrectionPolicyChangeDecisionRecord,
}

export default policyChangeDecisionRecordApi
