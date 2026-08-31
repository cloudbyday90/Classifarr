/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { apiClient, getDataRequest } from './core'

const POLICY_CHANGE_OUTCOME_OBSERVATION_PATH =
  '/policies/candidate-correction/policy-change-outcome-observation'

/** Reads one server-owned, aggregate-only observation without request selectors. */
export function getPolicyCandidateCorrectionPolicyChangeOutcomeObservation() {
  return getDataRequest(POLICY_CHANGE_OUTCOME_OBSERVATION_PATH)
}

/** Starts the current actor's recent approved native policy-change observation. */
export function startPolicyCandidateCorrectionPolicyChangeOutcomeObservation() {
  return apiClient.post(POLICY_CHANGE_OUTCOME_OBSERVATION_PATH, {})
}

const policyChangeOutcomeObservationApi = {
  getPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
  startPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
}

export default policyChangeOutcomeObservationApi
