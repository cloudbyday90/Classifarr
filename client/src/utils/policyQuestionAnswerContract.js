/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION = 'policy.runtime_question_answer.v1'

export const POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS = Object.freeze({
  CONFIRM_DESTINATION: 'confirm_destination',
  CHANGE_DESTINATION: 'change_destination',
  ROUTE_NOT_APPLICABLE: 'route_not_applicable',
  RETRY_CLASSIFICATION: 'retry_classification',
  MARK_EXACT_ITEM_MEMORY: 'mark_exact_item_memory',
  REQUEST_POLICY_EDIT: 'request_policy_edit',
})

function positiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

export function policyQuestionAnswer(item = {}) {
  const answer = item?.policy_question_answer
  if (!answer || answer.version !== POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION) return null
  if (typeof answer.fingerprint !== 'string' || !answer.fingerprint) return null
  if (!Array.isArray(answer.allowed_actions) || !Array.isArray(answer.candidate_destinations)) return null
  return answer
}

export function policyQuestionAnswerAction(answer, actionId) {
  return answer?.allowed_actions?.find(action => action?.id === actionId) || null
}

export function availablePolicyQuestionAnswerAction(answer, actionId) {
  const action = policyQuestionAnswerAction(answer, actionId)
  return action?.available === true ? action : null
}

export function buildPolicyQuestionAnswerPayload(answer, actionId, destinationLibraryId = null) {
  const action = availablePolicyQuestionAnswerAction(answer, actionId)
  if (!action) return null

  const destinationId = destinationLibraryId === null || destinationLibraryId === undefined
    ? null
    : positiveInteger(destinationLibraryId)
  if (action.destination_required === true && !destinationId) return null
  if (action.destination_required !== true && destinationLibraryId !== null && destinationLibraryId !== undefined) {
    return null
  }

  return {
    contract_version: answer.version,
    contract_fingerprint: answer.fingerprint,
    action_id: actionId,
    ...(destinationId ? { destination_library_id: destinationId } : {}),
  }
}
